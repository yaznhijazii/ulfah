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
    <div className={`relative ${sizes[size]} flex items-center justify-center ${className}`}>
      <Heart
        className="w-full h-full transition-all duration-500"
        style={{ color: '#f43f5e', filter: 'drop-shadow(0 0 10px rgba(244, 63, 94, 0.4))' }}
        fill="currentColor"
      />
    </div>
  );
}
