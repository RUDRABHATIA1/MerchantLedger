const Transaction = require('../models/Transaction');

// Helper to calculate Levenshtein distance
function LevenshteinDistance(a, b) {
  const tmp = [];
  let i, j;
  const alen = a.length;
  const blen = b.length;
  if (alen === 0) return blen;
  if (blen === 0) return alen;
  for (i = 0; i <= alen; i++) tmp[i] = [i];
  for (j = 0; j <= blen; j++) tmp[0][j] = j;
  for (i = 1; i <= alen; i++) {
    for (j = 1; j <= blen; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[alen][blen];
}

// GET /api/items/report
const getItemsReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {
      status: 'POSTED',
      'metadata.items': { $exists: true, $not: { $size: 0 } }
    };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Find all POSTED transactions with items in metadata
    const txns = await Transaction.find(query);

    // Flatten items and capture details
    const rawItems = [];
    txns.forEach(t => {
      const itemsList = t.metadata.items || [];
      const shopType = t.metadata.shopkeeperTxnType; 
      
      itemsList.forEach(item => {
        if (!item.item) return;
        // Check if direction is explicitly provided (e.g. from MANUFACTURING txn)
        let direction = item.direction;
        if (!direction) {
           direction = shopType === 'CREDIT_SALE' ? 'SOLD' : (t.metadata.direction || 'SOLD');
        }
        
        rawItems.push({
          name: item.item.trim(),
          quantity: parseFloat(item.quantity) || 0,
          eachCost: parseFloat(item.eachCost) || 0,
          direction,
          createdAt: t.createdAt
        });
      });
    });

    // Cluster items using Levenshtein distance <= 2
    const clusters = [];
    rawItems.forEach(entry => {
      const norm = entry.name.toLowerCase();
      // Find a cluster with representative name within distance of 2
      let cluster = clusters.find(c => {
        if (c.representative === norm) return true;
        // Check Levenshtein distance
        return LevenshteinDistance(c.representative, norm) <= 2;
      });

      if (!cluster) {
        cluster = {
          representative: norm,
          spellings: {},
          entries: []
        };
        clusters.push(cluster);
      }

      // Add entry to cluster
      cluster.entries.push(entry);
      cluster.spellings[entry.name] = (cluster.spellings[entry.name] || 0) + 1;
    });

    // Compile stats for each cluster
    const report = clusters.map(c => {
      // Find the most frequent raw spelling
      let bestSpelling = c.entries[0].name;
      let maxCount = 0;
      Object.entries(c.spellings).forEach(([spelling, count]) => {
        if (count > maxCount) {
          bestSpelling = spelling;
          maxCount = count;
        }
      });

      let totalQtyBought = 0;
      let totalQtySold = 0;
      let totalQtyConsumed = 0;
      let amountBought = 0;
      let amountSold = 0;

      c.entries.forEach(e => {
        if (e.direction === 'BUY' || e.direction === 'PRODUCED') {
          totalQtyBought += e.quantity;
          amountBought += e.quantity * e.eachCost;
        } else if (e.direction === 'CONSUMED') {
          totalQtyConsumed += e.quantity;
        } else {
          // Default to SOLD
          totalQtySold += e.quantity;
          amountSold += e.quantity * e.eachCost;
        }
      });

      const qtyLeft = totalQtyBought - totalQtySold - totalQtyConsumed;
      const avgPurchaseCost = totalQtyBought > 0 ? (amountBought / totalQtyBought) : 0;
      const profit = amountSold - (totalQtySold * avgPurchaseCost);

      return {
        name: bestSpelling,
        qtyBought: totalQtyBought,
        qtySold: totalQtySold,
        qtyConsumed: totalQtyConsumed,
        qtyLeft,
        amountBought,
        amountSold,
        avgPurchaseCost,
        profit,
        hasPurchases: totalQtyBought > 0
      };
    });

    res.json({ success: true, data: report });
  } catch (err) { next(err); }
};

// GET /api/items/autocomplete
const getItemNames = async (req, res, next) => {
  try {
    const txns = await Transaction.find({
      status: 'POSTED',
      'metadata.items.item': { $exists: true }
    }).select('metadata.items');

    const itemNames = new Set();
    txns.forEach(t => {
      const itemsList = t.metadata?.items || [];
      itemsList.forEach(i => {
        if (i.item) itemNames.add(i.item.trim());
      });
    });

    res.json({ success: true, data: Array.from(itemNames) });
  } catch (err) { next(err); }
};

// GET /api/items/report/:itemName
const getItemPartiesReport = async (req, res, next) => {
  try {
    const { itemName } = req.params;
    const decodedName = decodeURIComponent(itemName).toLowerCase();

    const { startDate, endDate } = req.query;
    const query = {
      status: 'POSTED',
      'metadata.items': { $exists: true, $not: { $size: 0 } }
    };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // 1. Fetch transactions that have items
    const txns = await Transaction.find(query);

    // 2. Filter transactions that have a matching item name (using Levenshtein <= 2 or exact match)
    const partyStats = {};
    let globalQtyBought = 0;
    let globalAmountBought = 0;

    txns.forEach(t => {
      const itemsList = t.metadata.items || [];
      const partyId = t.metadata.partyId;
      if (!partyId) return;

      const shopType = t.metadata.shopkeeperTxnType; 
      const direction = shopType === 'CREDIT_SALE' ? 'SOLD' : (t.metadata.direction || 'SOLD'); 

      itemsList.forEach(item => {
        if (!item.item) return;
        const norm = item.item.trim().toLowerCase();
        
        // Match condition: exact match or Levenshtein distance <= 2
        if (norm === decodedName || LevenshteinDistance(decodedName, norm) <= 2) {
          if (!partyStats[partyId]) {
            partyStats[partyId] = {
              qtyBought: 0,
              qtySold: 0,
              amountBought: 0,
              amountSold: 0,
              partyId
            };
          }

          const qty = parseFloat(item.quantity) || 0;
          const cost = parseFloat(item.eachCost) || 0;
          
          if (direction === 'BUY') {
            partyStats[partyId].qtyBought += qty;
            partyStats[partyId].amountBought += qty * cost;
            globalQtyBought += qty;
            globalAmountBought += qty * cost;
          } else {
            partyStats[partyId].qtySold += qty;
            partyStats[partyId].amountSold += qty * cost;
          }
        }
      });
    });

    const globalAvgPurchaseCost = globalQtyBought > 0 ? (globalAmountBought / globalQtyBought) : 0;

    // 3. Fetch party details and calculate final metrics
    const Party = require('../models/Party');
    const partyIds = Object.keys(partyStats);
    const parties = await Party.find({ _id: { $in: partyIds } });
    const partyMap = parties.reduce((acc, p) => { acc[p._id.toString()] = p; return acc; }, {});

    const report = Object.values(partyStats).map(stats => {
      const party = partyMap[stats.partyId.toString()];
      const qtyLeft = stats.qtyBought - stats.qtySold;
      const profit = stats.amountSold - (stats.qtySold * globalAvgPurchaseCost);

      return {
        partyId: stats.partyId,
        partyName: party ? party.name : 'Unknown Party',
        qtyBought: stats.qtyBought,
        qtySold: stats.qtySold,
        qtyLeft,
        amountBought: stats.amountBought,
        amountSold: stats.amountSold,
        avgPurchaseCost: globalAvgPurchaseCost,
        profit,
        hasPurchases: globalQtyBought > 0
      };
    });

    res.json({ success: true, data: report });
  } catch (err) { next(err); }
};

module.exports = { getItemsReport, getItemNames, getItemPartiesReport };
