import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout({ children, onRefresh }) {
  return (
    <div className="flex min-h-screen bg-bg-base text-text-primary">
      <Sidebar />
      <div className="flex-1 ml-[240px] pt-[64px] min-w-0 flex flex-col relative overflow-hidden">
        {/* Animated Background Gradients */}
        <div className="absolute inset-0 pointer-events-none -z-10">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-primary/5 rounded-full blur-[120px] mix-blend-screen animate-pulse-glow" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-primary/5 rounded-full blur-[120px] mix-blend-screen animate-pulse-glow" style={{ animationDelay: '1s' }} />
        </div>
        
        <Topbar onRefresh={onRefresh} />
        <main className="flex-1 animate-fade-in-up">{children}</main>
      </div>
    </div>
  );
}
