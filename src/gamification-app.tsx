import { useState, type ComponentType, type ReactNode } from "react";
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  Bolt,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Coins,
  Crown,
  Flame,
  Gift,
  Home,
  LogOut,
  Medal,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Swords,
  Target,
  Trophy,
  User,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./gamification.css";

type Page =
  | "overview"
  | "ranking"
  | "missions"
  | "challenges"
  | "wheel"
  | "rewards"
  | "achievements"
  | "profile"
  | "admin"
  | "team"
  | "points"
  | "settings";

type IconType = ComponentType<{ className?: string }>;

type UserData = {
  name: string;
  role: string;
  points: number;
  level: number;
  rank: number;
  sales: number;
  avatar: string;
  color: string;
};

type Mission = {
  title: string;
  description: string;
  progress: number;
  target: number;
  reward: number;
  icon: IconType;
};

const users: UserData[] = [
  { name: "João Martins", role: "SDR", points: 3480, level: 8, rank: 1, sales: 52000, avatar: "JM", color: "#FFC83D" },
  { name: "Amanda Silva", role: "Closer", points: 3120, level: 8, rank: 2, sales: 47500, avatar: "AS", color: "#855CFF" },
  { name: "Marcelo Alves", role: "SDR", points: 2950, level: 7, rank: 3, sales: 32500, avatar: "MA", color: "#00E887" },
  { name: "Lucas Rocha", role: "Closer", points: 2700, level: 7, rank: 4, sales: 39000, avatar: "LR", color: "#4776FF" },
  { name: "Gabriel Lima", role: "SDR", points: 2540, level: 6, rank: 5, sales: 28400, avatar: "GL", color: "#FF5252" },
  { name: "Carolina Melo", role: "Closer", points: 2310, level: 6, rank: 6, sales: 26100, avatar: "CM", color: "#27C2FF" },
];

const missions: Mission[] = [
  { title: "Fazer 5 ligações", description: "Conecte com novos leads", progress: 4, target: 5, reward: 20, icon: Activity },
  { title: "Agendar 2 reuniões", description: "Crie novas oportunidades", progress: 1, target: 2, reward: 50, icon: CalendarDays },
  { title: "Atualizar todos os leads no CRM", description: "Mantenha o pipeline em dia", progress: 1, target: 1, reward: 30, icon: ShieldCheck },
  { title: "Realizar uma reunião", description: "Avance uma oportunidade", progress: 0, target: 1, reward: 70, icon: Users },
];

const rewards = [
  { name: "R$ 20 iFood", cost: 500, icon: Gift },
  { name: "R$ 50 iFood", cost: 1000, icon: Gift },
  { name: "R$ 50 PIX", cost: 1200, icon: CircleDollarSign },
  { name: "R$ 100 PIX", cost: 2200, icon: CircleDollarSign },
  { name: "Almoço pago", cost: 1500, icon: Store },
  { name: "Sair 2h mais cedo", cost: 1800, icon: Zap },
  { name: "Day Off", cost: 5000, icon: Sparkles },
];

const achievements = [
  { title: "PRIMEIRA VENDA", description: "Sua primeira venda registrada", unlocked: true, icon: Medal },
  { title: "EM CHAMAS", description: "7 dias consecutivos", unlocked: true, icon: Flame },
  { title: "50K CLUB", description: "R$ 50 mil vendidos", unlocked: true, icon: CircleDollarSign },
  { title: "META BATIDA", description: "Atinja sua meta mensal", unlocked: false, icon: Target },
  { title: "CAMPEÃO", description: "Termine o mês em primeiro lugar", unlocked: false, icon: Crown },
  { title: "100K CLUB", description: "R$ 100 mil vendidos", unlocked: false, icon: Award },
];

const chartData = [
  { day: "01", vendas: 14000, pontos: 1700 },
  { day: "05", vendas: 28000, pontos: 4200 },
  { day: "10", vendas: 49000, pontos: 7100 },
  { day: "15", vendas: 73000, pontos: 10800 },
  { day: "20", vendas: 101000, pontos: 14500 },
  { day: "25", vendas: 127500, pontos: 18420 },
];

const barData = users.map((u) => ({ name: u.name.split(" ")[0], vendas: u.sales, pontos: u.points }));

const mainNav: Array<{ id: Page; label: string; icon: IconType }> = [
  { id: "overview", label: "Visão Geral", icon: Home },
  { id: "ranking", label: "Ranking", icon: Trophy },
  { id: "missions", label: "Missões", icon: Target },
  { id: "challenges", label: "Desafios", icon: Swords },
  { id: "wheel", label: "Roleta", icon: Sparkles },
  { id: "rewards", label: "Recompensas", icon: Gift },
  { id: "achievements", label: "Conquistas", icon: Medal },
  { id: "profile", label: "Perfil", icon: User },
];

const adminNav: Array<{ id: Page; label: string; icon: IconType }> = [
  { id: "admin", label: "Dashboard", icon: BarChart3 },
  { id: "team", label: "Equipe", icon: Users },
  { id: "points", label: "Pontuação", icon: Bolt },
  { id: "challenges", label: "Desafios", icon: Swords },
  { id: "rewards", label: "Recompensas", icon: Gift },
  { id: "settings", label: "Configurações", icon: Settings },
];

export function GamificationApp() {
  const [page, setPage] = useState<Page>("overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const navigate = (next: Page) => {
    setPage(next);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  return (
    <div className="min-h-screen bg-[#07111F] text-white selection:bg-[#00E887]/30">
      <Sidebar page={page} navigate={navigate} mobileMenu={mobileMenu} onClose={() => setMobileMenu(false)} notify={notify} />
      <div className="lg:pl-[250px]">
        <Topbar onMenu={() => setMobileMenu(true)} notificationsOpen={notificationsOpen} setNotificationsOpen={setNotificationsOpen} navigate={navigate} />
        <main className="mx-auto w-full max-w-[1500px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-7">
          {page === "overview" && <Dashboard navigate={navigate} />}
          {page === "ranking" && <RankingPage />}
          {page === "missions" && <MissionsPage notify={notify} />}
          {page === "challenges" && <ChallengesPage notify={notify} />}
          {page === "wheel" && <WheelPage notify={notify} />}
          {page === "rewards" && <RewardsPage notify={notify} />}
          {page === "achievements" && <AchievementsPage />}
          {page === "profile" && <ProfilePage />}
          {page === "admin" && <AdminDashboard navigate={navigate} notify={notify} />}
          {page === "team" && <TeamPage notify={notify} />}
          {page === "points" && <PointsPage notify={notify} />}
          {page === "settings" && <SettingsPage notify={notify} />}
        </main>
      </div>
      <MobileNav page={page} navigate={navigate} />
      {toast && <Toast message={toast} />}
    </div>
  );
}

function Sidebar({ page, navigate, mobileMenu, onClose, notify }: { page: Page; navigate: (page: Page) => void; mobileMenu: boolean; onClose: () => void; notify: (message: string) => void }) {
  return (
    <>
      {mobileMenu && <button aria-label="Fechar menu" onClick={onClose} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col border-r border-white/[0.08] bg-[#091522]/95 px-3 py-4 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${mobileMenu ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-5 flex items-center justify-between px-2">
          <button onClick={() => navigate("overview")} className="flex items-center gap-3 text-left">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#00E887] text-[#07111F] shadow-[0_0_30px_rgba(0,232,135,0.22)]"><Trophy className="h-5 w-5" /></div>
            <div><div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#94A3B8]">Orbion</div><div className="text-base font-black tracking-tight">Sales League</div></div>
          </button>
          <button onClick={onClose} className="rounded-xl p-2 text-[#94A3B8] hover:bg-white/5 lg:hidden"><X className="h-5 w-5" /></button>
        </div>
        <nav className="space-y-1">
          {mainNav.map((item) => <SidebarItem key={item.id} item={item} active={page === item.id} onClick={() => navigate(item.id)} />)}
        </nav>
        <div className="mt-5 border-t border-white/[0.08] pt-4">
          <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#64748B]">Administração</div>
          <div className="space-y-1">{adminNav.map((item) => <SidebarItem key={`${item.id}-${item.label}`} item={item} active={page === item.id} onClick={() => navigate(item.id)} small />)}</div>
        </div>
        <div className="mt-auto space-y-1 border-t border-white/[0.08] pt-4">
          <SidebarItem item={{ label: "Configurações", icon: Settings }} active={page === "settings"} onClick={() => navigate("settings")} />
          <button onClick={() => notify("Sessão de demonstração: logout simulado.")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#94A3B8] transition hover:bg-white/[0.05] hover:text-white"><LogOut className="h-4 w-4" />Sair</button>
        </div>
      </aside>
    </>
  );
}

function SidebarItem({ item, active, onClick, small = false }: { item: { label: string; icon: IconType }; active: boolean; onClick: () => void; small?: boolean }) {
  const Icon = item.icon;
  return <button onClick={onClick} className={`group flex w-full items-center gap-3 rounded-xl px-3 ${small ? "py-2" : "py-2.5"} text-left text-sm font-semibold transition ${active ? "bg-[#00E887]/12 text-[#00FF9C] shadow-[inset_0_0_0_1px_rgba(0,232,135,0.12)]" : "text-[#94A3B8] hover:bg-white/[0.05] hover:text-white"}`}><Icon className={`h-4 w-4 ${active ? "text-[#00E887]" : "text-[#64748B] group-hover:text-white"}`} />{item.label}{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#00E887] shadow-[0_0_10px_#00E887]" />}</button>;
}

function Topbar({ onMenu, notificationsOpen, setNotificationsOpen, navigate }: { onMenu: () => void; notificationsOpen: boolean; setNotificationsOpen: (value: boolean) => void; navigate: (page: Page) => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#07111F]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <button onClick={onMenu} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 text-[#94A3B8] lg:hidden"><Menu className="h-5 w-5" /></button>
        <div className="hidden items-center gap-2 text-xs font-medium text-[#64748B] lg:flex"><span className="h-2 w-2 rounded-full bg-[#00E887] shadow-[0_0_8px_#00E887]" />Temporada Setembro 2026</div>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-[#00E887]/15 bg-[#00E887]/5 px-3 py-2 text-xs font-bold text-[#00E887] sm:flex"><Coins className="h-4 w-4" />740 moedas</div>
          <div className="relative">
            <button onClick={() => setNotificationsOpen(!notificationsOpen)} className="relative rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 text-[#94A3B8] transition hover:text-white"><Bell className="h-5 w-5" /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#FF5252] ring-2 ring-[#07111F]" /></button>
            {notificationsOpen && <NotificationDropdown onClose={() => setNotificationsOpen(false)} />}
          </div>
          <button onClick={() => navigate("profile")} className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1.5 pr-3 transition hover:bg-white/[0.06]"><Avatar initials="MA" color="#00E887" size="sm" /><div className="hidden text-left sm:block"><div className="text-xs font-bold">Marcelo Alves</div><div className="text-[10px] text-[#64748B]">Closer · Nível 7</div></div></button>
        </div>
      </div>
    </header>
  );
}

function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const items = ["🔥 Você subiu para o 3º lugar.", "🎯 Faltam apenas 50 pontos para sua próxima recompensa.", "🎰 Você desbloqueou uma Roleta Premium.", "⚔️ Lucas está apenas 30 pontos atrás de você.", "🏆 Missão semanal concluída."];
  return <div className="absolute right-0 top-12 w-[330px] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0D1B2A] shadow-2xl"><div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3"><div><div className="font-bold">Notificações</div><div className="text-[11px] text-[#64748B]">5 novas atualizações</div></div><button onClick={onClose} className="rounded-lg p-1 text-[#64748B] hover:bg-white/5"><X className="h-4 w-4" /></button></div><div className="divide-y divide-white/[0.06]">{items.map((item, i) => <button key={item} className="block w-full px-4 py-3 text-left text-sm text-[#CBD5E1] transition hover:bg-white/[0.04]"><span className="block">{item}</span><span className="mt-1 block text-[10px] text-[#64748B]">{i === 0 ? "Agora" : `${i * 9 + 3} min`}</span></button>)}</div></div>;
}

function MobileNav({ page, navigate }: { page: Page; navigate: (page: Page) => void }) {
  const items = mainNav.filter((item) => ["overview", "ranking", "missions", "wheel", "profile"].includes(item.id));
  return <nav className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-2xl border border-white/[0.1] bg-[#0D1B2A]/95 p-2 shadow-2xl backdrop-blur-xl lg:hidden">{items.map((item) => { const Icon = item.icon; const active = page === item.id; return <button key={item.id} onClick={() => navigate(item.id)} className={`flex min-w-[58px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[9px] font-bold ${active ? "bg-[#00E887]/12 text-[#00E887]" : "text-[#64748B]"}`}><Icon className="h-5 w-5" />{item.label === "Visão Geral" ? "Início" : item.label}</button>; })}</nav>;
}

function Dashboard({ navigate }: { navigate: (page: Page) => void }) {
  return (
    <div className="space-y-5 lg:space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#00E887]"><Sparkles className="h-4 w-4" />Visão Geral</div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Bom dia, Marcelo 👋</h1><p className="mt-1 text-sm text-[#94A3B8]">Vamos subir no ranking hoje?</p></div>
        <div className="flex items-center gap-3"><Avatar initials="MA" color="#00E887" size="lg" /><div><div className="text-sm font-bold">3º colocado</div><div className="text-xs text-[#94A3B8]">171 pts do 2º lugar</div></div></div>
      </section>
      <LevelHero />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><StatCard label="Pontuação" value="1.850 pts" icon={Zap} color="#00E887" /><StatCard label="Ranking" value="3º lugar" icon={Trophy} color="#FFC83D" /><StatCard label="Sequência" value="🔥 6 dias" icon={Flame} color="#FF5252" /><StatCard label="Moedas" value="🪙 740" icon={Coins} color="#4776FF" /></div>
      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]"><SalesTarget /><NextReward onClick={() => navigate("wheel")} /></div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><RankingPreview navigate={navigate} /><EventBanner /></div>
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]"><MissionPreview navigate={navigate} /><ActivityFeed /></div>
    </div>
  );
}

function LevelHero() {
  return <section className="relative overflow-hidden rounded-[24px] border border-[#00E887]/20 bg-[linear-gradient(120deg,#102A28_0%,#0D1B2A_55%,#111F30_100%)] p-5 shadow-[0_20px_80px_rgba(0,232,135,0.08)] sm:p-7"><div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#00E887]/10 blur-3xl" /><div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="mb-3 flex flex-wrap items-center gap-2"><Badge color="green">NÍVEL 7</Badge><Badge color="dark"><Bolt className="h-3.5 w-3.5" /> TEMPORADA ATIVA</Badge></div><div className="flex items-end gap-2"><div className="text-4xl font-black tracking-tight sm:text-5xl">1.850</div><div className="pb-1 text-sm font-bold text-[#94A3B8]">pontos</div></div><div className="mt-5 max-w-3xl"><div className="mb-2 flex justify-between text-xs"><span className="font-bold text-white">1.850 / 2.000 XP</span><span className="text-[#94A3B8]">92,5%</span></div><Progress value={92.5} glow /><p className="mt-2 text-xs text-[#94A3B8]">Faltam <strong className="text-white">150 pontos</strong> para alcançar o nível 8.</p></div></div><div className="grid h-28 w-28 place-items-center rounded-full border border-[#00E887]/25 bg-[#00E887]/10 shadow-[0_0_50px_rgba(0,232,135,0.15)]"><div className="grid h-20 w-20 place-items-center rounded-full bg-[#00E887] text-[#07111F]"><Zap className="h-9 w-9 fill-current" /></div></div></div></section>;
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: IconType; color: string }) {
  return <div className="premium-card group p-4 transition duration-300 hover:-translate-y-1"><div className="mb-4 flex items-center justify-between"><div className="grid h-9 w-9 place-items-center rounded-xl" style={{ backgroundColor: `${color}18`, color }}><Icon className="h-4 w-4" /></div><ChevronRight className="h-4 w-4 text-[#334155] transition group-hover:translate-x-0.5 group-hover:text-[#94A3B8]" /></div><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">{label}</div><div className="mt-1 text-lg font-black tracking-tight sm:text-xl">{value}</div></div>;
}

function SalesTarget() {
  return <section className="premium-card p-5 sm:p-6"><SectionHeader eyebrow="META DE VENDAS" title="R$ 32.500" action={<span className="text-xs font-bold text-[#00E887]">65%</span>} /><div className="mt-2 text-sm text-[#94A3B8]">de <strong className="text-white">R$ 50.000</strong></div><div className="mt-6"><Progress value={65} large /><div className="mt-3 flex flex-col gap-2 text-xs text-[#94A3B8] sm:flex-row sm:items-center sm:justify-between"><span>Faltam <strong className="text-white">R$ 17.500</strong> para atingir sua meta.</span><span className="inline-flex items-center gap-1 font-bold text-[#FFC83D]"><Flame className="h-3.5 w-3.5" />Ritmo atual: meta projetada para 27/09</span></div></div></section>;
}

function NextReward({ onClick }: { onClick: () => void }) {
  return <section className="relative overflow-hidden rounded-[22px] border border-[#FFC83D]/25 bg-[linear-gradient(135deg,#241F14_0%,#151D29_60%,#111F30_100%)] p-5 shadow-[0_0_50px_rgba(255,200,61,0.07)] sm:p-6"><div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#FFC83D]/10 blur-3xl" /><div className="relative"><div className="flex items-start justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFC83D]">PRÓXIMA RECOMPENSA</div><h3 className="mt-2 flex items-center gap-2 text-xl font-black">🎰 Roleta Premium</h3></div><Crown className="h-6 w-6 text-[#FFC83D]" /></div><p className="mt-4 text-sm text-[#94A3B8]">Faltam apenas <strong className="text-2xl text-white">150 pontos</strong> para desbloquear.</p><div className="mt-5"><div className="mb-2 flex justify-between text-xs font-bold"><span>1.850 / 2.000</span><span className="text-[#FFC83D]">92,5%</span></div><Progress value={92.5} gold /></div><button onClick={onClick} className="mt-5 w-full rounded-xl border border-[#FFC83D]/20 bg-[#FFC83D]/10 px-4 py-3 text-sm font-black text-[#FFC83D] transition hover:bg-[#FFC83D]/15">Continuar pontuando</button></div></section>;
}

function RankingPreview({ navigate }: { navigate: (page: Page) => void }) {
  return <section className="premium-card p-5 sm:p-6"><SectionHeader eyebrow="🏆 RANKING DO MÊS" title="Você está a 171 pontos do 2º lugar." action={<button onClick={() => navigate("ranking")} className="text-xs font-bold text-[#00E887] hover:underline">Ver ranking</button>} /><div className="mt-5 space-y-2">{users.slice(0, 5).map((user, index) => <RankingRow key={user.name} user={user} highlighted={user.name === "Marcelo Alves"} medal={index < 3 ? ["🥇", "🥈", "🥉"][index] : undefined} />)}</div></section>;
}

function RankingRow({ user, highlighted, medal }: { user: UserData; highlighted?: boolean; medal?: string | undefined }) {
  return <div className={`flex items-center gap-3 rounded-2xl border p-3 transition hover:translate-x-1 ${highlighted ? "border-[#00E887]/25 bg-[#00E887]/8" : "border-white/[0.06] bg-white/[0.025]"}`}><div className="w-7 text-center text-sm font-black text-[#94A3B8]">{medal || `${user.rank}º`}</div><Avatar initials={user.avatar} color={user.color} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{user.name}{highlighted && <span className="ml-2 rounded-full bg-[#00E887]/12 px-2 py-0.5 text-[9px] font-black uppercase text-[#00E887]">Você</span>}</div><div className="text-[11px] text-[#64748B]">{user.role} · Nível {user.level}</div></div><div className="text-right"><div className="text-sm font-black">{user.points.toLocaleString("pt-BR")} pts</div><div className="text-[10px] text-[#64748B]">R$ {user.sales.toLocaleString("pt-BR")}</div></div></div>;
}

function EventBanner() {
  return <section className="relative overflow-hidden rounded-[22px] border border-[#FF5252]/25 bg-[linear-gradient(145deg,#35161D_0%,#111F30_72%)] p-5 sm:p-6"><div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#FF5252]/10 blur-3xl" /><div className="relative"><div className="mb-6 flex items-start justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF7272]">EVENTO ESPECIAL</div><h3 className="mt-2 flex items-center gap-2 text-2xl font-black"><Flame className="h-6 w-6 fill-[#FF5252] text-[#FF5252]" />HORA DO FOGO</h3></div><Badge color="red">HOJE</Badge></div><div className="rounded-2xl border border-white/[0.08] bg-black/10 p-4"><div className="text-xs text-[#94A3B8]">14:00 às 16:00</div><div className="mt-1 text-lg font-black text-[#FFC83D]">TODOS OS PONTOS EM DOBRO</div></div><div className="mt-5 flex items-center justify-between"><span className="text-xs text-[#94A3B8]">Começa em</span><div className="font-mono text-xl font-black tracking-wider">02:14:30</div></div></div></section>;
}

function MissionPreview({ navigate }: { navigate: (page: Page) => void }) {
  return <section className="premium-card p-5 sm:p-6"><SectionHeader eyebrow="MISSÕES DE HOJE" title="3 missões para acelerar seu ranking" action={<button onClick={() => navigate("missions")} className="text-xs font-bold text-[#00E887]">Ver todas</button>} /><div className="mt-5 space-y-3">{missions.slice(0, 3).map((mission) => <MissionCompact key={mission.title} mission={mission} />)}</div></section>;
}

function MissionCompact({ mission }: { mission: Mission }) {
  const done = mission.progress >= mission.target;
  const Icon = mission.icon;
  const percentage = Math.min(100, (mission.progress / mission.target) * 100);
  return <div className={`rounded-2xl border p-4 ${done ? "border-[#00E887]/20 bg-[#00E887]/5" : "border-white/[0.06] bg-white/[0.02]"}`}><div className="flex gap-3"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${done ? "bg-[#00E887]/15 text-[#00E887]" : "bg-white/[0.05] text-[#94A3B8]"}`}><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-bold">{mission.title}</div><div className="mt-0.5 text-[11px] text-[#64748B]">{mission.description}</div></div><span className="shrink-0 text-xs font-black text-[#00E887]">+{mission.reward} pts</span></div><div className="mt-3 flex items-center gap-3"><div className="flex-1"><Progress value={percentage} small /></div><span className="text-[10px] font-bold text-[#94A3B8]">{done ? "Completo" : `${mission.progress}/${mission.target}`}</span></div></div></div></div>;
}

function ActivityFeed() {
  const items = [
    { icon: "🔥", name: "João", text: "realizou uma venda de R$ 8.500", time: "Agora", initials: "JM", color: "#FFC83D" },
    { icon: "🏆", name: "Amanda", text: "desbloqueou “Meta Batida”", time: "12 min", initials: "AS", color: "#855CFF" },
    { icon: "🎰", name: "Lucas", text: "ganhou R$ 50 no PIX", time: "32 min", initials: "LR", color: "#4776FF" },
    { icon: "🚀", name: "Marcelo", text: "subiu para o nível 8", time: "1h", initials: "MA", color: "#00E887" },
  ];
  return <section className="premium-card p-5 sm:p-6"><SectionHeader eyebrow="ATIVIDADE DO TIME" title="O comercial está em movimento" /><div className="mt-5 space-y-4">{items.map((item) => <div key={`${item.name}-${item.time}`} className="flex gap-3"><Avatar initials={item.initials} color={item.color} size="sm" /><div className="min-w-0 flex-1"><div className="text-sm text-[#CBD5E1]"><span className="mr-1">{item.icon}</span><strong className="text-white">{item.name}</strong> {item.text}</div><div className="mt-1 text-[10px] text-[#64748B]">{item.time}</div></div></div>)}</div></section>;
}

function RankingPage() {
  return <PageFrame eyebrow="COMPETIÇÃO" title="Ranking do mês" subtitle="Acompanhe quem está puxando o ritmo da equipe."><Podium /><section className="premium-card mt-5 p-5 sm:p-6"><div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-sm font-bold">Classificação completa</div><div className="mt-1 text-xs text-[#94A3B8]">Você está a <strong className="text-[#00E887]">171 pontos</strong> do 2º lugar.</div></div><Badge color="green">TEMPORADA ATIVA</Badge></div><div className="space-y-2">{users.map((user, index) => <RankingRow key={user.name} user={user} highlighted={user.name === "Marcelo Alves"} medal={index < 3 ? ["🥇", "🥈", "🥉"][index] : undefined} />)}</div></section></PageFrame>;
}

function Podium() {
  const podium = [users[1]!, users[0]!, users[2]!];
  return <section className="premium-card overflow-hidden p-5 sm:p-7"><div className="mb-7 text-center"><div className="text-xs font-black uppercase tracking-[0.2em] text-[#FFC83D]">PÓDIO</div><div className="mt-2 text-sm text-[#94A3B8]">Top 3 da temporada atual</div></div><div className="mx-auto flex max-w-3xl items-end justify-center gap-3 sm:gap-7">{podium.map((user, index) => { const actual = [2, 1, 3][index]; const first = actual === 1; return <div key={user.name} className="flex flex-1 flex-col items-center"><div className={`relative ${first ? "mb-3" : "mb-2"}`}><div className={first ? "podium-glow" : ""}><Avatar initials={user.avatar} color={user.color} size={first ? "xl" : "lg"} /></div><span className="absolute -right-1 -top-2 text-xl">{actual === 1 ? "🥇" : actual === 2 ? "🥈" : "🥉"}</span></div><div className="mb-3 text-center"><div className={`font-black ${first ? "text-base sm:text-lg" : "text-sm"}`}>{user.name.split(" ")[0]}</div><div className="text-[11px] font-bold text-[#94A3B8]">{user.points.toLocaleString("pt-BR")} pts</div></div><div className={`flex w-full items-start justify-center rounded-t-[18px] border-x border-t border-white/[0.08] pt-4 font-black ${actual === 1 ? "h-32 bg-[linear-gradient(#FFC83D22,#111F30)] text-[#FFC83D]" : actual === 2 ? "h-24 bg-[linear-gradient(#CBD5E118,#111F30)] text-[#CBD5E1]" : "h-20 bg-[linear-gradient(#B9784A18,#111F30)] text-[#D49A72]"}`}><span className="text-3xl">{actual}</span></div></div>; })}</div></section>;
}

function MissionsPage({ notify }: { notify: (message: string) => void }) {
  const [filter, setFilter] = useState("Hoje");
  const [modal, setModal] = useState(false);
  return <PageFrame eyebrow="PONTUE TODO DIA" title="Missões" subtitle="Complete ações comerciais e transforme execução em pontos." action={<button onClick={() => setModal(true)} className="primary-btn"><Plus className="h-4 w-4" />Nova missão</button>}><div className="mb-5 flex gap-2 overflow-x-auto pb-1">{["Hoje", "Semana", "Especiais"].map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-xl px-4 py-2 text-xs font-bold ${filter === item ? "bg-[#00E887] text-[#07111F]" : "border border-white/[0.08] bg-white/[0.03] text-[#94A3B8]"}`}>{item}</button>)}</div><LightningMission /><div className="mt-5 grid gap-4 lg:grid-cols-2">{missions.map((mission) => <MissionCard key={mission.title} mission={mission} />)}</div>{modal && <MissionModal onClose={() => setModal(false)} onCreate={() => { setModal(false); notify("Missão criada com sucesso."); }} />}</PageFrame>;
}

function MissionCard({ mission }: { mission: Mission }) {
  const done = mission.progress >= mission.target;
  const Icon = mission.icon;
  const percentage = Math.min(100, (mission.progress / mission.target) * 100);
  return <section className={`premium-card p-5 transition hover:-translate-y-0.5 ${done ? "ring-1 ring-[#00E887]/20" : ""}`}><div className="flex items-start gap-4"><div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${done ? "bg-[#00E887]/12 text-[#00E887]" : "bg-[#4776FF]/10 text-[#7396FF]"}`}><Icon className="h-6 w-6" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h3 className="font-black">{mission.title}</h3><p className="mt-1 text-xs text-[#94A3B8]">{mission.description}</p></div><Badge color={done ? "green" : "blue"}>+{mission.reward} PTS</Badge></div><div className="mt-5"><div className="mb-2 flex justify-between text-[11px] font-bold"><span className={done ? "text-[#00E887]" : "text-[#CBD5E1]"}>{done ? "✅ MISSÃO CONCLUÍDA" : "EM PROGRESSO"}</span><span className="text-[#94A3B8]">{mission.progress} / {mission.target}</span></div><Progress value={percentage} /></div></div></div></section>;
}

function LightningMission() {
  return <section className="relative overflow-hidden rounded-[24px] border border-[#855CFF]/30 bg-[linear-gradient(135deg,#261D43_0%,#111F30_70%)] p-5 shadow-[0_0_45px_rgba(133,92,255,0.08)] sm:p-6"><div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[#855CFF]/15 blur-3xl" /><div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#B49BFF]"><Zap className="h-4 w-4 fill-current" />Missão Relâmpago</div><h3 className="text-xl font-black">Realize uma venda hoje</h3><p className="mt-2 text-sm text-[#94A3B8]">Recompensa: <strong className="text-[#FFC83D]">🎰 1 GIRO NA ROLETA PREMIUM</strong></p></div><div className="rounded-2xl border border-white/[0.08] bg-black/10 px-5 py-4 text-center"><div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Tempo restante</div><div className="mt-1 font-mono text-2xl font-black">04:32:15</div></div></div></section>;
}

function ChallengesPage({ notify }: { notify: (message: string) => void }) {
  const [modal, setModal] = useState(false);
  return <PageFrame eyebrow="COMPETIÇÃO SAUDÁVEL" title="Desafios" subtitle="Dispute, colabore e mantenha o time em ritmo alto." action={<button onClick={() => setModal(true)} className="primary-btn"><Plus className="h-4 w-4" />Novo desafio</button>}><div className="grid gap-5 xl:grid-cols-2"><DuelCard /><TeamChallenge /></div>{modal && <ChallengeModal onClose={() => setModal(false)} onCreate={() => { setModal(false); notify("Desafio criado com sucesso."); }} />}</PageFrame>;
}

function DuelCard() {
  return <section className="premium-card overflow-hidden p-5 sm:p-6"><div className="flex items-center justify-between"><Badge color="purple">⚔️ DUELO</Badge><span className="text-[11px] text-[#64748B]">Finaliza em 2 dias</span></div><div className="my-7 grid grid-cols-[1fr_auto_1fr] items-center gap-4"><div className="text-center"><div className="mx-auto w-fit"><Avatar initials="MA" color="#00E887" size="lg" /></div><div className="mt-3 text-sm font-black">MARCELO</div><div className="mt-1 text-2xl font-black text-[#00E887]">8</div><div className="text-[10px] text-[#64748B]">reuniões</div></div><div className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-black text-[#94A3B8]">VS</div><div className="text-center"><div className="mx-auto w-fit"><Avatar initials="LR" color="#4776FF" size="lg" /></div><div className="mt-3 text-sm font-black">LUCAS</div><div className="mt-1 text-2xl font-black text-[#4776FF]">6</div><div className="text-[10px] text-[#64748B]">reuniões</div></div></div><div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Objetivo</div><div className="mt-1 text-sm font-semibold">Quem realizar mais reuniões até sexta-feira.</div><div className="mt-4 h-3 overflow-hidden rounded-full bg-[#4776FF]/25"><div className="h-full w-[57%] rounded-full bg-[#00E887] shadow-[0_0_15px_rgba(0,232,135,.3)]" /></div><div className="mt-4 flex items-center justify-between"><span className="text-xs text-[#94A3B8]">Prêmio</span><strong className="text-sm text-[#FFC83D]">+300 pontos</strong></div></div></section>;
}

function TeamChallenge() {
  return <section className="relative overflow-hidden rounded-[22px] border border-[#FF5252]/20 bg-[linear-gradient(145deg,#25161B,#111F30_65%)] p-5 sm:p-6"><div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-[#FF5252]/10 blur-3xl" /><div className="relative"><div className="flex items-center justify-between"><Badge color="red">🔥 DESAFIO DO TIME</Badge><Users className="h-5 w-5 text-[#FF7272]" /></div><h3 className="mt-5 text-xl font-black">R$ 50.000 em vendas</h3><div className="mt-1 text-sm text-[#94A3B8]">Realizado: <strong className="text-white">R$ 38.500</strong></div><div className="mt-6"><div className="mb-2 flex justify-between text-xs font-bold"><span>Progresso coletivo</span><span className="text-[#FF7272]">77%</span></div><Progress value={77} red /></div><div className="mt-6 rounded-2xl border border-[#FFC83D]/15 bg-[#FFC83D]/5 p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-[#FFC83D]">Prêmio coletivo</div><div className="mt-1 font-black">🎁 Roleta Premium para todos.</div></div></div></section>;
}

function WheelPage({ notify }: { notify: (message: string) => void }) {
  const [type, setType] = useState<"classic" | "premium">("premium");
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState<string | null>(null);
  const classic = ["R$ 10 PIX", "100 pontos", "R$ 20 PIX", "Giro extra", "R$ 30 iFood", "200 pontos"];
  const premium = ["R$ 50 PIX", "500 pontos", "R$ 100 PIX", "Giro extra", "R$ 50 iFood", "1.000 pontos", "2x pontos", "Mystery Box"];
  const prizes = type === "premium" ? premium : classic;
  const spin = () => {
    if (spinning) return;
    setWon(null); setSpinning(true);
    const index = Math.floor(Math.random() * prizes.length);
    setRotation((prev) => prev + 1440 + 360 - (index * 360) / prizes.length + 20);
    window.setTimeout(() => { setSpinning(false); setWon(prizes[index] ?? prizes[0] ?? "500 pontos"); }, 3200);
  };
  return <PageFrame eyebrow="RECOMPENSAS INSTANTÂNEAS" title="Central de Roletas" subtitle="Desbloqueie giros, acumule prêmios e mantenha sua sequência ativa."><div className="mb-5 grid grid-cols-2 gap-3"><button onClick={() => !spinning && setType("classic")} className={`rounded-2xl border p-4 text-left transition ${type === "classic" ? "border-[#4776FF]/40 bg-[#4776FF]/10" : "border-white/[0.08] bg-white/[0.02]"}`}><div className="text-xs font-black text-[#7396FF]">ROLETA CLÁSSICA</div><div className="mt-1 text-[11px] text-[#94A3B8]">Prêmios para manter o ritmo.</div></button><button onClick={() => !spinning && setType("premium")} className={`rounded-2xl border p-4 text-left transition ${type === "premium" ? "border-[#FFC83D]/40 bg-[#FFC83D]/10" : "border-white/[0.08] bg-white/[0.02]"}`}><div className="text-xs font-black text-[#FFC83D]">ROLETA PREMIUM</div><div className="mt-1 text-[11px] text-[#94A3B8]">Prêmios de maior valor.</div></button></div><section className={`relative overflow-hidden rounded-[28px] border p-5 sm:p-8 ${type === "premium" ? "border-[#FFC83D]/25 bg-[radial-gradient(circle_at_top,#352A12,#111F30_50%)]" : "border-[#4776FF]/25 bg-[radial-gradient(circle_at_top,#172C56,#111F30_50%)]"}`}><div className="grid gap-8 xl:grid-cols-[1fr_0.8fr] xl:items-center"><div className="relative mx-auto grid w-full max-w-[500px] place-items-center"><div className="wheel-pointer" /><div className={`wheel ${type}`} style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 3.2s cubic-bezier(0.12,0.68,0.13,1)" : "none" }}><div className="wheel-center"><Sparkles className="h-7 w-7" /></div></div></div><div><Badge color={type === "premium" ? "gold" : "blue"}>{type === "premium" ? "PREMIUM" : "CLÁSSICA"}</Badge><h3 className="mt-4 text-3xl font-black">{type === "premium" ? "Roleta Premium" : "Roleta Clássica"}</h3><p className="mt-2 text-sm leading-6 text-[#94A3B8]">{type === "premium" ? "Uma seleção especial de recompensas para quem está no topo da execução." : "Conquiste pontos e desbloqueie recompensas durante a semana."}</p><div className="mt-5 grid grid-cols-2 gap-2">{prizes.map((prize) => <div key={prize} className="rounded-xl border border-white/[0.06] bg-black/10 px-3 py-2 text-[11px] font-bold text-[#CBD5E1]">{prize}</div>)}</div><button onClick={spin} disabled={spinning} className={`mt-6 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black transition ${type === "premium" ? "bg-[#FFC83D] text-[#171205] hover:bg-[#FFD45F]" : "bg-[#4776FF] text-white hover:bg-[#5B86FF]"} disabled:cursor-not-allowed disabled:opacity-60`}><Sparkles className={`h-5 w-5 ${spinning ? "animate-spin" : ""}`} />{spinning ? "GIRANDO..." : "GIRAR ROLETA"}</button></div></div></section>{won && <WinModal prize={won} onClose={() => setWon(null)} onRedeem={() => { setWon(null); notify(`${won} adicionado às suas recompensas.`); }} />}</PageFrame>;
}

function WinModal({ prize, onClose, onRedeem }: { prize: string; onClose: () => void; onRedeem: () => void }) {
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-[#020710]/80 p-4 backdrop-blur-md"><div className="confetti-layer">{Array.from({ length: 24 }).map((_, i) => <i key={i} style={{ left: `${(i * 17) % 100}%`, animationDelay: `${(i % 7) * 0.08}s` }} />)}</div><div className="relative w-full max-w-md rounded-[28px] border border-[#FFC83D]/30 bg-[#0D1B2A] p-7 text-center shadow-[0_0_90px_rgba(255,200,61,.16)]"><button onClick={onClose} className="absolute right-4 top-4 rounded-xl p-2 text-[#64748B] hover:bg-white/5"><X className="h-5 w-5" /></button><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#FFC83D]/12 text-4xl">🎉</div><div className="mt-5 text-xs font-black uppercase tracking-[0.24em] text-[#FFC83D]">PARABÉNS!</div><h3 className="mt-2 text-2xl font-black">Você ganhou</h3><div className="mt-4 text-3xl font-black text-[#00E887]">{prize}</div><button onClick={onRedeem} className="primary-btn mt-7 w-full justify-center">Resgatar recompensa</button></div></div>;
}

function RewardsPage({ notify }: { notify: (message: string) => void }) {
  const coins = 1850;
  const [selected, setSelected] = useState<string | null>(null);
  const [rewardModal, setRewardModal] = useState(false);
  return <PageFrame eyebrow="CARTEIRA & LOJA" title="Recompensas" subtitle="Use suas Orb Coins para resgatar benefícios reais." action={<button onClick={() => setRewardModal(true)} className="secondary-btn"><Plus className="h-4 w-4" />Cadastrar recompensa</button>}><section className="relative overflow-hidden rounded-[24px] border border-[#00E887]/20 bg-[linear-gradient(135deg,#102A28,#111F30_60%)] p-5 sm:p-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00E887]">MINHA CARTEIRA</div><div className="mt-2 flex items-center gap-2 text-3xl font-black"><Coins className="h-7 w-7 text-[#FFC83D]" />1.850 <span className="text-base text-[#94A3B8]">Orb Coins</span></div></div><div className="grid grid-cols-3 gap-2 text-center text-[10px]"><WalletMetric value="+100" label="Venda" /><WalletMetric value="+50" label="Missão" /><WalletMetric value="+200" label="Meta" /></div></div><div className="mt-6 grid gap-2 sm:grid-cols-3">{[["+100", "Venda realizada", "Hoje, 09:41"], ["+50", "Missão concluída", "Hoje, 08:32"], ["+200", "Meta semanal", "Ontem"]].map(([value, title, date]) => <div key={title} className="rounded-xl border border-white/[0.06] bg-black/10 p-3"><div className="text-sm font-black text-[#00E887]">{value}</div><div className="mt-1 text-xs font-bold">{title}</div><div className="mt-1 text-[10px] text-[#64748B]">{date}</div></div>)}</div></section><div className="mt-6 mb-4 flex items-end justify-between"><div><div className="text-xs font-black uppercase tracking-[0.18em] text-[#94A3B8]">LOJA DE RECOMPENSAS</div><h2 className="mt-1 text-xl font-black">Escolha seu próximo prêmio</h2></div><Badge color="green">{coins.toLocaleString("pt-BR")} moedas</Badge></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{rewards.map((reward) => { const Icon = reward.icon; const affordable = coins >= reward.cost; return <section key={reward.name} className="premium-card group p-5 transition hover:-translate-y-1"><div className="flex items-start justify-between"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFC83D]/10 text-[#FFC83D]"><Icon className="h-6 w-6" /></div><div className="text-right"><div className="text-sm font-black">{reward.cost.toLocaleString("pt-BR")}</div><div className="text-[10px] text-[#64748B]">moedas</div></div></div><h3 className="mt-5 text-lg font-black">{reward.name}</h3><p className="mt-1 text-xs text-[#94A3B8]">Recompensa disponível para resgate imediato.</p><button disabled={!affordable} onClick={() => { setSelected(reward.name); notify(`${reward.name} selecionado para resgate.`); }} className="mt-5 w-full rounded-xl bg-[#00E887] px-4 py-3 text-sm font-black text-[#07111F] transition hover:bg-[#00FF9C] disabled:cursor-not-allowed disabled:bg-white/[0.05] disabled:text-[#64748B]">{affordable ? (selected === reward.name ? "Selecionado" : "Resgatar") : `Faltam ${(reward.cost - coins).toLocaleString("pt-BR")} moedas`}</button></section>; })}</div>{rewardModal && <RewardModal onClose={() => setRewardModal(false)} onCreate={() => { setRewardModal(false); notify("Recompensa cadastrada com sucesso."); }} />}</PageFrame>;
}

function WalletMetric({ value, label }: { value: string; label: string }) { return <div className="rounded-xl border border-white/[0.06] bg-black/10 px-3 py-2"><div className="font-black text-[#00E887]">{value}</div><div className="text-[#64748B]">{label}</div></div>; }

function AchievementsPage() {
  return <PageFrame eyebrow="PROGRESSO & STATUS" title="Conquistas" subtitle="Marcos que mostram sua evolução dentro da temporada."><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{achievements.map((achievement) => { const Icon = achievement.icon; return <section key={achievement.title} className={`relative overflow-hidden rounded-[22px] border p-5 transition ${achievement.unlocked ? "border-[#FFC83D]/20 bg-[linear-gradient(145deg,#1E1B14,#111F30)] hover:-translate-y-1" : "border-white/[0.06] bg-[#0D1724] opacity-55 grayscale"}`}><div className={`grid h-14 w-14 place-items-center rounded-2xl ${achievement.unlocked ? "bg-[#FFC83D]/10 text-[#FFC83D]" : "bg-white/[0.05] text-[#64748B]"}`}><Icon className="h-7 w-7" /></div><div className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-[#64748B]">{achievement.unlocked ? "CONQUISTADO" : "BLOQUEADO"}</div><h3 className="mt-1 text-lg font-black">{achievement.title}</h3><p className="mt-1 text-xs text-[#94A3B8]">{achievement.description}</p>{achievement.unlocked && <div className="absolute right-4 top-4 text-lg">✨</div>}</section>; })}</div></PageFrame>;
}

function ProfilePage() {
  return <PageFrame eyebrow="MEU DESEMPENHO" title="Perfil" subtitle="Seu histórico, números e conquistas da temporada."><section className="premium-card p-5 sm:p-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><Avatar initials="MA" color="#00E887" size="xl" /><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-black">Marcelo Alves</h2><Badge color="green">NÍVEL 7</Badge></div><div className="mt-1 text-sm text-[#94A3B8]">Closer · Orbion Sales</div><div className="mt-3 flex items-center gap-2 text-sm font-bold"><Zap className="h-4 w-4 text-[#00E887]" />2.950 pontos</div></div><div className="sm:text-right"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#64748B]">Posição atual</div><div className="mt-1 text-3xl font-black text-[#FFC83D]">3º</div></div></div><div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4"><ProfileStat label="Vendas" value="R$ 32.500" /><ProfileStat label="Reuniões" value="27" /><ProfileStat label="Conversão" value="24%" /><ProfileStat label="Posição" value="3º" /></div></section><section className="premium-card mt-5 p-5 sm:p-6"><SectionHeader eyebrow="CONQUISTAS" title="3 de 6 desbloqueadas" /><div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">{achievements.map((achievement) => { const Icon = achievement.icon; return <div key={achievement.title} className={`rounded-2xl border p-3 text-center ${achievement.unlocked ? "border-[#FFC83D]/20 bg-[#FFC83D]/5 text-[#FFC83D]" : "border-white/[0.06] bg-white/[0.02] text-[#475569]"}`}><Icon className="mx-auto h-6 w-6" /><div className="mt-2 truncate text-[9px] font-black">{achievement.title}</div></div>; })}</div></section></PageFrame>;
}

function ProfileStat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">{label}</div><div className="mt-2 text-xl font-black">{value}</div></div>; }

function AdminDashboard({ navigate, notify }: { navigate: (page: Page) => void; notify: (message: string) => void }) {
  const [missionModal, setMissionModal] = useState(false);
  const [challengeModal, setChallengeModal] = useState(false);
  return <PageFrame eyebrow="ADMINISTRAÇÃO" title="Central de Gestão" subtitle="Visão do desempenho, gamificação e eficiência do time."><div className="mb-5 flex flex-wrap gap-2"><button onClick={() => setMissionModal(true)} className="secondary-btn"><Plus className="h-4 w-4" />Criar missão</button><button onClick={() => setChallengeModal(true)} className="secondary-btn"><Swords className="h-4 w-4" />Criar desafio</button><button onClick={() => navigate("team")} className="secondary-btn"><Users className="h-4 w-4" />Gerenciar equipe</button></div><div className="grid grid-cols-2 gap-3 xl:grid-cols-6"><AdminMetric label="Meta do time" value="R$ 200 mil" color="#00E887" /><AdminMetric label="Realizado" value="R$ 127.500" color="#4776FF" /><AdminMetric label="Atingimento" value="63,7%" color="#855CFF" /><AdminMetric label="Pontos distribuídos" value="18.420" color="#FFC83D" /><AdminMetric label="Recompensas" value="R$ 720" color="#FF5252" /><AdminMetric label="Missões concluídas" value="184" color="#27C2FF" /></div><div className="mt-5 grid gap-5 xl:grid-cols-2"><ChartCard title="Evolução de vendas" subtitle="Acumulado no mês"><ResponsiveContainer width="100%" height={260}><AreaChart data={chartData}><defs><linearGradient id="sales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00E887" stopOpacity={0.3}/><stop offset="95%" stopColor="#00E887" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false}/><XAxis dataKey="day" stroke="#64748B" fontSize={10}/><YAxis stroke="#64748B" fontSize={10}/><Tooltip contentStyle={{ background: "#0D1B2A", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12 }} /><Area type="monotone" dataKey="vendas" stroke="#00E887" fill="url(#sales)" strokeWidth={3}/></AreaChart></ResponsiveContainer></ChartCard><ChartCard title="Pontos por colaborador" subtitle="Competição saudável"><ResponsiveContainer width="100%" height={260}><BarChart data={barData}><CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false}/><XAxis dataKey="name" stroke="#64748B" fontSize={10}/><YAxis stroke="#64748B" fontSize={10}/><Tooltip contentStyle={{ background: "#0D1B2A", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12 }} /><Bar dataKey="pontos" fill="#4776FF" radius={[7,7,0,0]}/></BarChart></ResponsiveContainer></ChartCard></div><div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><ChartCard title="Evolução de pontos" subtitle="Pontos distribuídos ao longo do mês"><ResponsiveContainer width="100%" height={220}><LineChart data={chartData}><CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false}/><XAxis dataKey="day" stroke="#64748B" fontSize={10}/><YAxis stroke="#64748B" fontSize={10}/><Tooltip contentStyle={{ background: "#0D1B2A", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12 }} /><Line type="monotone" dataKey="pontos" stroke="#FFC83D" strokeWidth={3} dot={{ fill: "#FFC83D", r: 3 }}/></LineChart></ResponsiveContainer></ChartCard><section className="premium-card p-5"><SectionHeader eyebrow="INDICADORES" title="Saúde comercial" /><div className="mt-5 space-y-4"><MetricProgress label="Conversão" value={24} target="Meta 30%" /><MetricProgress label="Comparecimento" value={68} target="Meta 70%" /><MetricProgress label="CRM atualizado" value={91} target="Meta 95%" /><MetricProgress label="Atividades realizadas" value={76} target="1.248 ações" /></div></section></div>{missionModal && <MissionModal onClose={() => setMissionModal(false)} onCreate={() => { setMissionModal(false); notify("Missão criada e publicada para o time."); }} />}{challengeModal && <ChallengeModal onClose={() => setChallengeModal(false)} onCreate={() => { setChallengeModal(false); notify("Desafio criado e publicado para o time."); }} />}</PageFrame>;
}

function AdminMetric({ label, value, color }: { label: string; value: string; color: string }) { return <div className="premium-card p-4"><div className="mb-3 h-1.5 w-8 rounded-full" style={{ background: color }} /><div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">{label}</div><div className="mt-1 text-lg font-black">{value}</div></div>; }

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) { return <section className="premium-card p-5"><div className="mb-5"><div className="font-black">{title}</div><div className="mt-1 text-xs text-[#64748B]">{subtitle}</div></div>{children}</section>; }

function MetricProgress({ label, value, target }: { label: string; value: number; target: string }) { return <div><div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold">{label}</span><span className="text-[#64748B]">{target}</span></div><Progress value={value} /></div>; }

function TeamPage({ notify }: { notify: (message: string) => void }) {
  const [selected, setSelected] = useState<UserData | null>(null);
  return <PageFrame eyebrow="ADMINISTRAÇÃO" title="Gestão da equipe" subtitle="Acompanhe desempenho, nível e status de cada colaborador." action={<button onClick={() => notify("Fluxo de novo colaborador preparado para integração futura.")} className="primary-btn"><Plus className="h-4 w-4" />Adicionar colaborador</button>}><section className="premium-card hidden overflow-hidden md:block"><div className="grid grid-cols-[1.6fr_.8fr_.7fr_.6fr_.6fr_1fr_.7fr_.8fr] gap-3 border-b border-white/[0.06] px-5 py-3 text-[10px] font-black uppercase tracking-wider text-[#64748B]"><span>Nome</span><span>Cargo</span><span>Pontos</span><span>Nível</span><span>Ranking</span><span>Vendas</span><span>Status</span><span></span></div>{users.map((user) => <div key={user.name} className="grid grid-cols-[1.6fr_.8fr_.7fr_.6fr_.6fr_1fr_.7fr_.8fr] items-center gap-3 border-b border-white/[0.04] px-5 py-4 text-sm last:border-0 hover:bg-white/[0.02]"><div className="flex items-center gap-3"><Avatar initials={user.avatar} color={user.color} size="sm" /><span className="font-bold">{user.name}</span></div><span className="text-[#94A3B8]">{user.role}</span><span className="font-bold">{user.points.toLocaleString("pt-BR")}</span><span>{user.level}</span><span>{user.rank}º</span><span>R$ {user.sales.toLocaleString("pt-BR")}</span><span className="text-[#00E887]">Ativo</span><button onClick={() => setSelected(user)} className="text-xs font-bold text-[#7396FF]">Ver perfil</button></div>)}</section><div className="grid gap-3 md:hidden">{users.map((user) => <section key={user.name} className="premium-card p-4"><div className="flex items-center gap-3"><Avatar initials={user.avatar} color={user.color} /><div className="flex-1"><div className="font-bold">{user.name}</div><div className="text-xs text-[#64748B]">{user.role} · Nível {user.level}</div></div><Badge color="green">{user.rank}º</Badge></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><ProfileStat label="Pontos" value={user.points.toLocaleString("pt-BR")} /><ProfileStat label="Vendas" value={`${Math.round(user.sales / 1000)}k`} /><ProfileStat label="Status" value="Ativo" /></div><button onClick={() => setSelected(user)} className="secondary-btn mt-4 w-full justify-center">Ver perfil</button></section>)}</div>{selected && <UserModal user={selected} onClose={() => setSelected(null)} />}</PageFrame>;
}

function UserModal({ user, onClose }: { user: UserData; onClose: () => void }) { return <Modal title="Perfil do colaborador" onClose={onClose}><div className="flex items-center gap-4"><Avatar initials={user.avatar} color={user.color} size="lg" /><div><div className="text-xl font-black">{user.name}</div><div className="text-sm text-[#94A3B8]">{user.role} · Nível {user.level}</div></div></div><div className="mt-6 grid grid-cols-2 gap-3"><ProfileStat label="Pontos" value={user.points.toLocaleString("pt-BR")} /><ProfileStat label="Ranking" value={`${user.rank}º`} /><ProfileStat label="Vendas" value={`R$ ${user.sales.toLocaleString("pt-BR")}`} /><ProfileStat label="Status" value="Ativo" /></div><button onClick={onClose} className="primary-btn mt-6 w-full justify-center">Fechar</button></Modal>; }

function PointsPage({ notify }: { notify: (message: string) => void }) {
  const initial = [["Reunião agendada", 10], ["Reunião realizada", 20], ["Venda realizada", 100], ["R$ 10.000 vendidos", 150], ["Meta semanal", 200], ["Meta mensal", 500], ["CRM atualizado", 10], ["Recuperação de lead", 30], ["Upsell", 80]] as Array<[string, number]>;
  const [rules, setRules] = useState(initial);
  const [modal, setModal] = useState(false);
  return <PageFrame eyebrow="ADMINISTRAÇÃO" title="Configuração de pontos" subtitle="Defina quais comportamentos e resultados geram pontos." action={<button onClick={() => setModal(true)} className="primary-btn"><Plus className="h-4 w-4" />Adicionar regra</button>}><section className="premium-card p-5 sm:p-6"><div className="space-y-2">{rules.map(([label, points]) => <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#00E887]/10 text-[#00E887]"><Zap className="h-5 w-5" /></div><div className="flex-1"><div className="text-sm font-bold">{label}</div><div className="mt-0.5 text-[10px] text-[#64748B]">Regra ativa para toda a equipe</div></div><div className="rounded-xl bg-[#00E887]/10 px-3 py-2 text-sm font-black text-[#00E887]">+{points}</div></div>)}</div></section>{modal && <RuleModal onClose={() => setModal(false)} onCreate={(name, points) => { setRules([...rules, [name, points]]); setModal(false); notify("Nova regra de pontuação adicionada."); }} />}</PageFrame>;
}

function SettingsPage({ notify }: { notify: (message: string) => void }) {
  const [notifications, setNotifications] = useState(true);
  const [doublePoints, setDoublePoints] = useState(true);
  return <PageFrame eyebrow="PREFERÊNCIAS" title="Configurações" subtitle="Ajustes do ambiente de demonstração."><div className="grid gap-5 lg:grid-cols-2"><section className="premium-card p-5 sm:p-6"><SectionHeader eyebrow="USUÁRIO" title="Preferências" /><div className="mt-5 space-y-3"><SettingRow label="Notificações em tempo real" description="Alertas sobre ranking, missões e recompensas" checked={notifications} onChange={setNotifications} /><SettingRow label="Eventos de pontos em dobro" description="Receber alertas de eventos especiais" checked={doublePoints} onChange={setDoublePoints} /></div></section><section className="premium-card p-5 sm:p-6"><SectionHeader eyebrow="PLATAFORMA" title="MVP conectado ao GitHub" /><p className="mt-4 text-sm leading-6 text-[#94A3B8]">Estrutura preparada para receber autenticação, banco de dados e regras persistentes via Supabase em uma próxima etapa.</p><button onClick={() => notify("Configurações salvas para esta demonstração.")} className="primary-btn mt-5">Salvar configurações</button></section></div></PageFrame>;
}

function SettingRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) { return <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"><div className="flex-1"><div className="text-sm font-bold">{label}</div><div className="mt-1 text-[11px] text-[#64748B]">{description}</div></div><button onClick={() => onChange(!checked)} className={`relative h-7 w-12 rounded-full transition ${checked ? "bg-[#00E887]" : "bg-[#334155]"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${checked ? "left-6" : "left-1"}`} /></button></div>; }

function MissionModal({ onClose, onCreate }: { onClose: () => void; onCreate: () => void }) {
  return <Modal title="Nova missão" subtitle="Transforme uma atividade comercial em objetivo gamificado." onClose={onClose}><div className="grid gap-4 sm:grid-cols-2"><Field label="Nome" placeholder="Ex: Fazer 10 ligações" /><Field label="Tipo" placeholder="Diária" /><Field label="Objetivo" placeholder="Ligações realizadas" /><Field label="Quantidade" placeholder="10" /><Field label="Pontuação" placeholder="50" /><Field label="Participantes" placeholder="Todos" /><Field label="Data inicial" placeholder="14/09/2026" /><Field label="Data final" placeholder="14/09/2026" /></div><Field label="Descrição" placeholder="Descrição da missão" textarea /><button onClick={onCreate} className="primary-btn mt-5 w-full justify-center">CRIAR MISSÃO</button></Modal>;
}

function ChallengeModal({ onClose, onCreate }: { onClose: () => void; onCreate: () => void }) {
  return <Modal title="Novo desafio" subtitle="Configure a disputa e a recompensa." onClose={onClose}><div className="grid gap-4 sm:grid-cols-2"><Field label="Nome" placeholder="Ex: Duelo de reuniões" /><Field label="Participantes" placeholder="Marcelo e Lucas" /><Field label="Métrica" placeholder="Reuniões" /><Field label="Meta" placeholder="10" /><Field label="Período" placeholder="7 dias" /><Field label="Recompensa" placeholder="300 pontos" /></div><Field label="Descrição" placeholder="Descrição do desafio" textarea /><button onClick={onCreate} className="primary-btn mt-5 w-full justify-center">CRIAR DESAFIO</button></Modal>;
}

function RewardModal({ onClose, onCreate }: { onClose: () => void; onCreate: () => void }) {
  return <Modal title="Cadastrar recompensa" subtitle="Defina custo, categoria e disponibilidade." onClose={onClose}><div className="grid gap-4 sm:grid-cols-2"><Field label="Nome da recompensa" placeholder="Ex: R$ 50 PIX" /><Field label="Categoria" placeholder="PIX" /><Field label="Valor" placeholder="R$ 50,00" /><Field label="Custo em moedas" placeholder="1.200" /><Field label="Quantidade disponível" placeholder="10" /><Field label="Imagem ou ícone" placeholder="Ícone padrão" /></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><button className="secondary-btn justify-center">Ativo</button><button className="secondary-btn justify-center text-[#64748B]">Inativo</button></div><button onClick={onCreate} className="primary-btn mt-5 w-full justify-center">CADASTRAR RECOMPENSA</button></Modal>;
}

function RuleModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, points: number) => void }) {
  const [name, setName] = useState("");
  const [points, setPoints] = useState("50");
  return <Modal title="Adicionar regra" subtitle="Crie uma nova forma de pontuar." onClose={onClose}><label className="block"><span className="field-label">Nome da regra</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Lead recuperado" className="field-input" /></label><label className="mt-4 block"><span className="field-label">Pontuação</span><input value={points} onChange={(e) => setPoints(e.target.value)} placeholder="50" className="field-input" /></label><button onClick={() => onCreate(name || "Nova atividade", Number(points) || 50)} className="primary-btn mt-5 w-full justify-center">ADICIONAR REGRA</button></Modal>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-[#020710]/80 p-4 backdrop-blur-md"><div className="my-8 w-full max-w-2xl rounded-[24px] border border-white/[0.1] bg-[#0D1B2A] p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-start justify-between gap-4"><div><h3 className="text-xl font-black">{title}</h3>{subtitle && <p className="mt-1 text-xs text-[#94A3B8]">{subtitle}</p>}</div><button onClick={onClose} className="rounded-xl p-2 text-[#64748B] hover:bg-white/5"><X className="h-5 w-5" /></button></div>{children}</div></div>;
}

function Field({ label, placeholder, textarea }: { label: string; placeholder: string; textarea?: boolean }) {
  return <label className={`block ${textarea ? "mt-4" : ""}`}><span className="field-label">{label}</span>{textarea ? <textarea placeholder={placeholder} className="field-input min-h-[90px] resize-none" /> : <input placeholder={placeholder} className="field-input" />}</label>;
}

function PageFrame({ eyebrow, title, subtitle, action, children }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode; children: ReactNode }) {
  return <div><div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#00E887]">{eyebrow}</div><h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{title}</h1><p className="mt-1 max-w-2xl text-sm text-[#94A3B8]">{subtitle}</p></div>{action}</div>{children}</div>;
}

function SectionHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) { return <div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#64748B]">{eyebrow}</div><h3 className="mt-1 text-lg font-black tracking-tight">{title}</h3></div>{action}</div>; }

function Progress({ value, glow, large, small, gold, red }: { value: number; glow?: boolean; large?: boolean; small?: boolean; gold?: boolean; red?: boolean }) {
  const color = gold ? "#FFC83D" : red ? "#FF5252" : "#00E887";
  return <div className={`overflow-hidden rounded-full bg-white/[0.06] ${large ? "h-4" : small ? "h-1.5" : "h-2.5"}`}><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: `linear-gradient(90deg, ${color}, ${gold ? "#FFE08B" : red ? "#FF7A7A" : "#00FF9C"})`, boxShadow: glow ? `0 0 18px ${color}66` : undefined }} /></div>;
}

function Badge({ children, color = "dark" }: { children: ReactNode; color?: "green" | "gold" | "red" | "blue" | "purple" | "dark" }) {
  const classes = { green: "border-[#00E887]/20 bg-[#00E887]/10 text-[#00E887]", gold: "border-[#FFC83D]/20 bg-[#FFC83D]/10 text-[#FFC83D]", red: "border-[#FF5252]/20 bg-[#FF5252]/10 text-[#FF7272]", blue: "border-[#4776FF]/20 bg-[#4776FF]/10 text-[#7396FF]", purple: "border-[#855CFF]/20 bg-[#855CFF]/10 text-[#B49BFF]", dark: "border-white/[0.08] bg-white/[0.04] text-[#94A3B8]" };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${classes[color]}`}>{children}</span>;
}

function Avatar({ initials, color, size = "md" }: { initials: string; color: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes = { sm: "h-8 w-8 text-[10px]", md: "h-10 w-10 text-xs", lg: "h-14 w-14 text-sm", xl: "h-20 w-20 text-lg" };
  return <div className={`grid shrink-0 place-items-center rounded-2xl border font-black text-[#07111F] shadow-inner ${sizes[size]}`} style={{ background: `linear-gradient(135deg, ${color}, ${color}AA)`, borderColor: `${color}55` }}>{initials}</div>;
}

function Toast({ message }: { message: string }) { return <div className="fixed bottom-24 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-[#00E887]/20 bg-[#0D1B2A] px-4 py-3 text-sm font-bold shadow-2xl lg:bottom-6"><Check className="h-4 w-4 text-[#00E887]" />{message}</div>; }
