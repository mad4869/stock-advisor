'use client';

import { Signal } from '@/types';
import { TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown } from 'lucide-react';

interface SignalBadgeProps {
  signal: Signal;
  size?: 'sm' | 'md' | 'lg';
}

const signalConfig: Record<Signal, { label: string; color: string; bgColor: string; icon: any }> = {
  STRONG_BUY: {
    label: 'Strong Buy',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15 border-emerald-500/30',
    icon: ArrowUp,
  },
  BUY: {
    label: 'Buy',
    color: 'text-green-400',
    bgColor: 'bg-green-500/15 border-green-500/30',
    icon: TrendingUp,
  },
  HOLD: {
    label: 'Hold',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/15 border-yellow-500/30',
    icon: Minus,
  },
  SELL: {
    label: 'Sell',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/15 border-orange-500/30',
    icon: TrendingDown,
  },
  STRONG_SELL: {
    label: 'Strong Sell',
    color: 'text-red-400',
    bgColor: 'bg-red-500/15 border-red-500/30',
    icon: ArrowDown,
  },
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-3 py-1',
  lg: 'text-base px-4 py-2',
};

export default function SignalBadge({ signal, size = 'md' }: SignalBadgeProps) {
  const config = signalConfig[signal];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-full border ${config.bgColor} ${config.color} ${sizeClasses[size]}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'} />
      {config.label}
    </span>
  );
}