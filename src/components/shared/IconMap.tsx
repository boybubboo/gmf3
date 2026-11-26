import React from 'react';
import {
  ArrowDown,
  ArrowDownCircle,
  ArrowLeftCircle,
  ArrowRight,
  ArrowRightCircle,
  ArrowUp,
  ArrowUpCircle,
  ArrowUpRight,
  Award,
  Bell,
  BookOpen,
  Boxes,
  Car,
  Castle,
  Circle,
  CircleDot,
  CloudLightning,
  CloudFog,
  CloudRain,
  Compass,
  Crown,
  Diamond,
  Eye,
  EyeOff,
  Film,
  Flame,
  Flag,
  Footprints,
  Gem,
  Gift,
  GitBranch,
  Grid2x2,
  Grid3x3,
  Hammer,
  Hand,
  Heart,
  HeartCrack,
  Home,
  Hourglass,
  KeyRound,
  LayoutGrid,
  Leaf,
  Lightbulb,
  List,
  LockOpen,
  Map as MapIcon,
  MessageCircle,
  MoonStar,
  Mountain,
  Paintbrush,
  Paperclip,
  Pause,
  PawPrint,
  Play,
  PlusCircle,
  RefreshCw,
  Send,
  Shield,
  ShieldCheck,
  Sliders,
  Smile,
  Snowflake,
  Sparkles,
  SquareStack,
  Sun,
  Sunset,
  Target,
  Timer,
  Trees,
  TriangleAlert,
  User,
  Users,
  Volume2,
  VolumeX,
  Wand2,
  Waves,
  Wind,
  Wrench,
  Zap,
} from 'lucide-react';

interface MakerIconProps {
  symbol: string;
  size?: number;
  className?: string;
  color?: string;
}

export const MakerIcon: React.FC<MakerIconProps> = ({
  symbol,
  size = 16,
  className = '',
  color,
}) => {
  const props = { size, className, style: color ? { color } : undefined, strokeWidth: 2.2 };

  switch (symbol) {
    case 'castle.fill':
      return <Castle {...props} />;
    case 'car.fill':
      return <Car {...props} />;
    case 'house.fill':
      return <Home {...props} />;
    case 'pawprint.fill':
      return <PawPrint {...props} />;
    case 'cube.fill':
      return <Boxes {...props} />;
    case 'figure.run':
    case 'hare.fill':
      return <Footprints {...props} />;
    case 'figure.walk':
    case 'figure.stand':
    case 'figure.dance':
    case 'figure.kickboxing':
    case 'figure.arms.open':
    case 'person.fill':
      return <User {...props} />;
    case 'person.2.fill':
      return <Users {...props} />;
    case 'bubble.left.fill':
    case 'text.bubble.fill':
      return <MessageCircle {...props} />;
    case 'bolt.fill':
      return <Zap {...props} />;
    case 'gift.fill':
      return <Gift {...props} />;
    case 'key.fill':
      return <KeyRound {...props} />;
    case 'lock.open.fill':
      return <LockOpen {...props} />;
    case 'bag.fill':
      return <ShoppingBagFallback {...props} />;
    case 'exclamationmark.triangle.fill':
      return <TriangleAlert {...props} />;
    case 'arrow.triangle.2.circlepath':
      return <RefreshCw {...props} />;
    case 'square.grid.2x2.fill':
    case 'square.grid.2x2':
      return <Grid2x2 {...props} />;
    case 'square.grid.3x3.fill':
      return <Grid3x3 {...props} />;
    case 'leaf.fill':
      return <Leaf {...props} />;
    case 'tree.fill':
      return <Trees {...props} />;
    case 'square.stack.3d.up.fill':
      return <SquareStack {...props} />;
    case 'lightbulb.fill':
      return <Lightbulb {...props} />;
    case 'sparkles':
    case 'wand.and.stars':
      return <Sparkles {...props} />;
    case 'flag.fill':
      return <Flag {...props} />;
    case 'sun.max.fill':
    case 'sun.dust.fill':
      return <Sun {...props} />;
    case 'sunset.fill':
      return <Sunset {...props} />;
    case 'moon.stars.fill':
      return <MoonStar {...props} />;
    case 'cloud.fog.fill':
      return <CloudFog {...props} />;
    case 'cloud.bolt.fill':
      return <CloudLightning {...props} />;
    case 'cloud.rain.fill':
      return <CloudRain {...props} />;
    case 'snowflake':
      return <Snowflake {...props} />;
    case 'mountain.2.fill':
      return <Mountain {...props} />;
    case 'drop.fill':
      return <Waves {...props} />;
    case 'map.fill':
    case 'map':
      return <MapIcon {...props} />;
    case 'flame.fill':
      return <Flame {...props} />;
    case 'shield.fill':
    case 'shield.checkerboard':
      return <Shield {...props} />;
    case 'hammer.fill':
      return <Hammer {...props} />;
    case 'scope':
      return <Target {...props} />;
    case 'heart.fill':
    case 'cross.case.fill':
      return <Heart {...props} />;
    case 'heart.slash.fill':
      return <HeartCrack {...props} />;
    case 'hand.wave.fill':
    case 'hand.raised.fill':
    case 'hand.point.up.fill':
    case 'hand.tap.fill':
    case 'hand.thumbsup.fill':
      return <Hand {...props} />;
    case 'face.smiling.fill':
      return <Smile {...props} />;
    case 'book.fill':
      return <BookOpen {...props} />;
    case 'arrow.triangle.branch':
      return <GitBranch {...props} />;
    case 'slider.horizontal.3':
      return <Sliders {...props} />;
    case 'paperplane.fill':
      return <Send {...props} />;
    case 'crown.fill':
      return <Crown {...props} />;
    case 'speaker.wave.2.fill':
      return <Volume2 {...props} />;
    case 'speaker.slash':
    case 'speaker.slash.fill':
      return <VolumeX {...props} />;
    case 'bell.fill':
      return <Bell {...props} />;
    case 'wind':
      return <Wind {...props} />;
    case 'arrow.up':
    case 'arrow.up.to.line':
      return <ArrowUp {...props} />;
    case 'arrow.down':
    case 'arrow.down.to.line':
      return <ArrowDown {...props} />;
    case 'arrow.up.circle.fill':
      return <ArrowUpCircle {...props} />;
    case 'arrow.down.circle.fill':
      return <ArrowDownCircle {...props} />;
    case 'arrow.right':
    case 'arrow.right.to.line':
      return <ArrowRight {...props} />;
    case 'arrow.right.circle.fill':
      return <ArrowRightCircle {...props} />;
    case 'arrow.left.circle.fill':
      return <ArrowLeftCircle {...props} />;
    case 'arrow.up.right':
      return <ArrowUpRight {...props} />;
    case 'paintbrush.fill':
      return <Paintbrush {...props} />;
    case 'circle.fill':
      return <CircleDot {...props} />;
    case 'diamond.fill':
      return <Gem {...props} />;
    case 'timer':
      return <Timer {...props} />;
    case 'list.bullet':
      return <List {...props} />;
    case 'pause.fill':
      return <Pause {...props} />;
    case 'play.fill':
      return <Play {...props} />;
    case 'chart.bar.fill':
    case 'number.circle.fill':
      return <LayoutGrid {...props} />;
    case 'eye.fill':
      return <Eye {...props} />;
    case 'eye.slash.fill':
      return <EyeOff {...props} />;
    case 'plus.circle.fill':
      return <PlusCircle {...props} />;
    case 'checkmark.seal.fill':
      return <ShieldCheck {...props} />;
    case 'hourglass':
      return <Hourglass {...props} />;
    case 'waveform.path':
      return <Compass {...props} />;
    case 'wand':
      return <Wand2 {...props} />;
    case 'award':
      return <Award {...props} />;
    case 'diamond':
      return <Diamond {...props} />;
    case 'paperclip':
      return <Paperclip {...props} />;
    case 'motion.studio':
      return <Film {...props} />;
    case 'interaction.designer':
      return <Wrench {...props} />;
    default:
      return <Circle {...props} />;
  }
};

const ShoppingBagFallback: React.FC<{ size?: number; className?: string; style?: React.CSSProperties; strokeWidth?: number }> = (props) => (
  <Gift {...props} />
);
