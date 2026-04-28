/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

/**
 * Application-specific types
 */

export interface CustomerData {
  id?: number;
  title?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  notes?: string;
}

export interface MoveData {
  id?: number;
  customerId: number;
  moveCode: string;
  pickupAddress: string;
  deliveryAddress: string;
  pickupDate: Date;
  deliveryDate: Date;
  volume?: number;
  grossPrice?: number;
  distance?: number;
  moveType?: string;
  status?: string;
  paymentStatus?: string;
  assignedSupervisor?: number;
  assignedWorkers?: string;
}

export interface MessageTemplateData {
  id?: number;
  name: string;
  language: string;
  subject?: string;
  content: string;
  isDefault?: number;
}

export interface GeneratedMessage {
  templateId: number;
  moveId: number;
  content: string;
}

export interface TaskData {
  id?: number;
  moveId: number;
  assignedTo: number;
  taskType?: string;
  status?: string;
  notes?: string;
  completedAt?: Date;
}

export interface PaymentData {
  id?: number;
  moveId: number;
  amount: number;
  paymentMethod?: string;
  paymentDate?: Date;
  notes?: string;
  recordedBy: number;
}
