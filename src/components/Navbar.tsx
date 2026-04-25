'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TrendingUp, Calculator, Eye, BarChart3, PieChart, Search, LineChart } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: BarChart3 },
  { href: '/recommend', label: 'Recommendations', icon: TrendingUp },
  { href: '/calculator', label: 'Lot Calculator', icon: Calculator },
  { href: '/watchlist', label: 'Watchlist', icon: Eye },
  { href: '/screener', label: 'Screener', icon: Search },
  { href: '/analysis', label: 'Analysis', icon: LineChart },
  { href: '/portfolio', label: 'Portfolio', icon: PieChart },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 glass border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">StockAdvisor</span>
          </Link>

          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}