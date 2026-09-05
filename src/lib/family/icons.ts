import {
  Backpack,
  Briefcase,
  CalendarClock,
  Car,
  Dumbbell,
  FileText,
  HeartPulse,
  House,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  backpack: Backpack,
  dumbbell: Dumbbell,
  "heart-pulse": HeartPulse,
  house: House,
  users: Users,
  "calendar-clock": CalendarClock,
  star: Star,
  briefcase: Briefcase,
  "file-text": FileText,
  car: Car,
};

export function categoryIcon(name: string): LucideIcon {
  return MAP[name] ?? Star;
}
