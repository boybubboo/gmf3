import React from 'react';
import {
  Axe,
  Backpack,
  Bone,
  Cherry,
  Crown,
  Fish,
  Flame,
  FlaskConical,
  Gem,
  Hammer,
  Leaf,
  Package,
  Shield,
  Shirt,
  Sparkles,
  Sprout,
  Sword,
  Trees,
  Utensils,
  Wind,
} from 'lucide-react';

export const InventoryItemIcon: React.FC<{
  icon: string;
  size?: number;
  color?: string;
  className?: string;
}> = ({ icon, size = 16, color = 'currentColor', className }) => {
  const props = { size, color, strokeWidth: 2.1, className };
  switch (icon) {
    case 'sword':
      return <Sword {...props} />;
    case 'axe':
      return <Axe {...props} />;
    case 'fish':
      return <Fish {...props} />;
    case 'flame':
      return <Flame {...props} />;
    case 'hammer':
      return <Hammer {...props} />;
    case 'trees':
      return <Trees {...props} />;
    case 'cherry':
      return <Cherry {...props} />;
    case 'leaf':
      return <Leaf {...props} />;
    case 'flask':
      return <FlaskConical {...props} />;
    case 'utensils':
      return <Utensils {...props} />;
    case 'sparkles':
      return <Sparkles {...props} />;
    case 'gem':
      return <Gem {...props} />;
    case 'sprout':
      return <Sprout {...props} />;
    case 'bone':
      return <Bone {...props} />;
    case 'crown':
      return <Crown {...props} />;
    case 'shirt':
      return <Shirt {...props} />;
    case 'shield':
      return <Shield {...props} />;
    case 'backpack':
      return <Backpack {...props} />;
    case 'blanket':
    case 'wind':
      return <Wind {...props} />;
    default:
      return <Package {...props} />;
  }
};
