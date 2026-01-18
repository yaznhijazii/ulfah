import { Heart } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Logo({ size = 'md', className = '' }: LogoProps) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-pink-400 to-rose-400 flex items-center justify-center ${className}`}>
      <Heart className="w-1/2 h-1/2 text-white" fill="currentColor" />
    </div>
  );
}
