// src/types/ui.ts
import { InputHTMLAttributes, ReactNode } from "react";
import { HTMLMotionProps } from "framer-motion";
import { Exercise, TrainingSession, Player } from "./models";

export type Page = 'login' | 'dashboard' | 'team' | 'session-planner' | 'training' | 'basics' | 'principles' | 'tactics' | 'match' | 'vision';

export type Category = 'Players' | 'Sessions' | 'Exercises' | 'Basics' | 'Principles' | 'Tactics';

export interface Result {
  id: string;
  label: string;
  sub: string;
  page: Page;
  category: Category;
}

export interface NavigationProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export interface ExerciseSlideOverProps {
  exercise: Exercise | null;
  onClose: () => void;
  onEdit: (exercise: Exercise) => void;
  onDelete: (id: string) => void;
}

export interface SessionSlideOverProps {
  session: TrainingSession | null;
  allPlayers: Player[];
  allExercises: Exercise[];
  isPast: boolean;
  onClose: () => void;
  onEdit: (session: TrainingSession) => void;
  onDelete: (id: string) => void;
  onExportPDF: (session: TrainingSession) => void;
}

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref" | "children"> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  isLoading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  animate?: boolean;
  delay?: number;
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface CountUpProps {
  value: number;
  suffix?: string;
  className?: string;
  duration?: number;
}

export interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  label?: string;
  error?: string;
  rightElement?: ReactNode;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}

export interface SelectProps {
  label?: string;
  error?: string;
  options: { label: string; value: string | number }[];
  value?: string | number;
  onChange: (value: string | number) => void;
  className?: string;
  placeholder?: string;
}

export interface SkeletonProps {
  className?: string;
}

export interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
  label?: string;
}

export interface PlayerSlideOverProps {
  player: Player | null;
  computedAttendance: Record<string, number>;
  onClose: () => void;
  onEdit: (player: Player) => void;
  onDelete: (id: string) => void;
}
