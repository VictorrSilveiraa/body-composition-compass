export type Pose = 'front' | 'back' | 'right' | 'left';
export const POSES: { k: Pose; l: string; hint: string }[];
export const POSE_KEYS: Pose[];
export function poseLabel(k: string): string;
export function poseHint(k: string): string;
export const GUIDE: { head: number; feet: number; center: number };
export function poseSvg(k: string, opts?: { guides?: boolean; cls?: string }): string;
