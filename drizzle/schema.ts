import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  username: varchar("username", { length: 100 }), // Username for local login (created by admin)
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "branch_manager", "supervisor", "worker", "sales"]).default("sales").notNull(),
  branchId: int("branchId"), // Which branch this user belongs to (NULL for super-admin)
  passwordHash: varchar("passwordHash", { length: 255 }), // For local login (created by admin)
  localEmail: varchar("localEmail", { length: 320 }), // Email for local login
  isLocalUser: int("isLocalUser").default(0).notNull(), // 1 = created by admin (local), 0 = OAuth
  isActive: int("isActive").default(1).notNull(), // 1 = active, 0 = deactivated/deleted
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Branches table - stores company branches/locations
 */
export const branches = mysqlTable("branches", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(), // e.g., "Frankfurt", "Hamburg"
  city: varchar("city", { length: 255 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  manager: int("manager"), // User ID of branch manager
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Branch = typeof branches.$inferSelect;
export type InsertBranch = typeof branches.$inferInsert;

/**
 * Customers table - stores customer information
 */
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull(), // Link to branch
  title: varchar("title", { length: 50 }), // Herr, Frau, etc.
  firstName: varchar("firstName", { length: 255 }).notNull(),
  lastName: varchar("lastName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  company: varchar("company", { length: 255 }),

  notes: text("notes"),
  // Extended Kunde fields
  sitz: varchar("sitz", { length: 100 }), // Frankfurt, Hamburg, etc.
  status2: varchar("status2", { length: 100 }), // Registriert auf Apex, etc.
  versuch: varchar("versuch", { length: 50 }), // Versuch 1, 2, etc.
  callCheck: varchar("callCheck", { length: 10 }), // Ja/Nein
  shaden: varchar("shaden", { length: 10 }), // Ja/Nein
  angebotPerPost: int("angebotPerPost").default(0), // 0/1
  bezahlt: int("bezahlt").default(0), // 0/1
  mitFotos: int("mitFotos").default(1), // 0/1
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

/**
 * Moves/Shipments table - stores individual move orders
 */
export const moves = mysqlTable("moves", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull(), // Link to branch
  customerId: int("customerId").notNull(),
  moveCode: varchar("moveCode", { length: 50 }).notNull().unique(), // e.g., Fa18894
  // Pickup details
  pickupAddress: text("pickupAddress").notNull(),
  pickupFloor: varchar("pickupFloor", { length: 50 }), // e.g., "2.Etage"
  pickupElevatorCapacity: varchar("pickupElevatorCapacity", { length: 100 }), // e.g., "kein Aufzug vorhanden"
  pickupParkingDistance: varchar("pickupParkingDistance", { length: 100 }), // e.g., "40 - 50 m"
  // Delivery details
  deliveryAddress: text("deliveryAddress").notNull(),
  deliveryFloor: varchar("deliveryFloor", { length: 50 }), // e.g., "2.Etage"
  deliveryElevatorCapacity: varchar("deliveryElevatorCapacity", { length: 100 }), // e.g., "kein Aufzug vorhanden"
  deliveryParkingDistance: varchar("deliveryParkingDistance", { length: 100 }), // e.g., "10 - 20 m"
  // Move details
  pickupDate: timestamp("pickupDate").notNull(),
  deliveryDate: timestamp("deliveryDate").notNull(),
  volume: int("volume"), // in m³
  grossPrice: decimal("grossPrice", { precision: 15, scale: 2 }),
  distance: int("distance"), // in km
  numTrips: int("numTrips").default(0), // Number of trips
  moveType: varchar("moveType", { length: 100 }), // Umzug, etc.
  services: text("services"), // JSON array of additional services
  // Immobilien fields
  auszugFlaeche: int("auszugflaeche"), // m²
  auszugZimmer: int("auszugzimmer"),
  einzugFlaeche: int("einzugflaeche"), // m²
  einzugZimmer: int("einzugzimmer"),
  // Address extra
  anfahrt: int("anfahrt").default(0),
  // Services JSON (full services data)
  servicesJson: text("servicesjson"), // Full JSON of all services
  // Note fields
  summary: text("summary"),
  anmerkungen: text("anmerkungen"),
  serviceanmerkungen: text("serviceanmerkungen"),
  moebelListe: text("moebelliste"),
  kundenNote: text("kundennote"),
  kontaktinfo: text("kontaktinfo"),
  // Finanzen fields
  anzahlung: int("anzahlung"),
  restbetrag: int("restbetrag"),
  zahlungsart: varchar("zahlungsart", { length: 100 }),
  rechnungNr: varchar("rechnungnr", { length: 100 }),
  // Web Bewertung
  bewertungPlatform: varchar("bewertungplatform", { length: 100 }),
  bewertungScore: int("bewertungscore"),
  bewertungLink: varchar("bewertunglink", { length: 500 }),
  // Plan fields
  planMitarbeiter: int("planmitarbeiter"),
  planFahrzeuge: int("planfahrzeuge"),
  planStartzeit: varchar("planstartzeit", { length: 10 }),
  planEndzeit: varchar("planendzeit", { length: 10 }),
  planBemerkungen: text("planbemerkungen"),
  // Beschwerde/Schaden extra
  schadenKosten: int("schadenkosten"),
  schadenStatus: varchar("schadenstatus", { length: 100 }),
  beschwerdeSchweregard: varchar("beschwerdeschweregrad", { length: 50 }),
  extraVolumen: int("extravolumen"),
  extraPreis: int("extrapreis"),
  extraBemerkungen: text("extrabemerkungen"),
  status: mysqlEnum("status", ["pending", "confirmed", "in_progress", "completed", "cancelled"]).default("pending").notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["unpaid", "partial", "paid"]).default("unpaid").notNull(),
  assignedSupervisor: int("assignedSupervisor"), // Supervisor ID
  assignedWorkers: text("assignedWorkers"), // JSON array of worker IDs
  // Damage and complaint reports
  schadenDescription: text("schaden_description"), // Damage description
  schadenImages: text("schaden_images"), // JSON array of S3 URLs for damage photos
  beschwerdeDescription: text("beschwerde_description"), // Complaint description
  beschwerdeImages: text("beschwerde_images"), // JSON array of S3 URLs for complaint photos
  completedAt: timestamp("completed_at"), // When worker marked as completed
  // Audits - Payment & Invoice section
  bezahltVon: varchar("bezahlt_von", { length: 100 }).default("Kunde"), // Kunde / Firma
  betzhalKunde: varchar("betzhalkunde", { length: 200 }), // Customer payment name
  istBezahlt: int("ist_bezahlt").default(0), // 0=Nein, 1=Ja
  paymentWay: varchar("payment_way", { length: 50 }).default("Bank"), // Bank / Bank and Bar / Bar
  auditTotalPrice: int("audit_total_price"), // Total price in cents
  bezahltDatum: timestamp("bezahlt_datum"), // Payment date
  bankBetrag: int("bank_betrag"), // Bank amount in cents
  barBetrag: int("bar_betrag"), // Cash amount in cents
  rechnungAusgestellt: int("rechnung_ausgestellt").default(0), // 0=Nein, 1=Ja
  rechnungBetrag: int("rechnung_betrag"), // Invoice amount in cents
  rechnungNummer: varchar("rechnung_nummer", { length: 100 }), // Invoice number
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Move = typeof moves.$inferSelect;
export type InsertMove = typeof moves.$inferInsert;

/**
 * Move Images table - stores images for each move
 */
export const moveImages = mysqlTable("moveImages", {
  id: int("id").autoincrement().primaryKey(),
  moveId: int("moveId").notNull(),
  imageUrl: text("imageUrl").notNull(), // S3 URL
  imageKey: varchar("imageKey", { length: 500 }).default("").notNull(), // S3 key for reference
  imageType: varchar("imageType", { length: 50 }).default("customer_photos").notNull(), // customer_photos, schaden, beschwerde
  uploadedBy: int("uploadedBy").default(0).notNull(), // User ID
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type MoveImage = typeof moveImages.$inferSelect;
export type InsertMoveImage = typeof moveImages.$inferInsert;

/**
 * Message Templates table - stores customizable message templates
 */
export const messageTemplates = mysqlTable("messageTemplates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  language: varchar("language", { length: 10 }).default("de").notNull(), // de, en, ar
  subject: varchar("subject", { length: 500 }),
  content: text("content").notNull(), // Template with {{variables}}
  isDefault: int("isDefault").default(0),
  variables: text("variables"), // JSON array of available variables
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = typeof messageTemplates.$inferInsert;

/**
 * Message History table - stores generated messages for audit trail
 */
export const messageHistory = mysqlTable("messageHistory", {
  id: int("id").autoincrement().primaryKey(),
  moveId: int("moveId").notNull(),
  templateId: int("templateId").notNull(),
  generatedContent: text("generatedContent").notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  sentAt: timestamp("sentAt"),
  sentBy: int("sentBy"), // User ID
});

export type MessageHistory = typeof messageHistory.$inferSelect;
export type InsertMessageHistory = typeof messageHistory.$inferInsert;

/**
 * Revenue Summary table - stores monthly revenue summaries per branch
 */
export const revenueSummary = mysqlTable("revenueSummary", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull(),
  year: int("year").notNull(),
  month: int("month").notNull(), // 1-12
  totalRevenue: decimal("totalRevenue", { precision: 12, scale: 2 }).default("0"),
  totalMoves: int("totalMoves").default(0),
  totalDamages: decimal("totalDamages", { precision: 12, scale: 2 }).default("0"),
  netRevenue: decimal("netRevenue", { precision: 12, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RevenueSummary = typeof revenueSummary.$inferSelect;
export type InsertRevenueSummary = typeof revenueSummary.$inferInsert;

/**
 * Additional Services table - stores available services
 */
export const additionalServices = mysqlTable("additionalServices", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(), // e.g., "Verpackung", "Auf- und Abbau"
  description: text("description"),
  price: int("price"), // in cents
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdditionalService = typeof additionalServices.$inferSelect;
export type InsertAdditionalService = typeof additionalServices.$inferInsert;

/**
 * Tasks table - stores tasks assigned to supervisors and workers
 */
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  moveId: int("moveId").notNull(),
  assignedTo: int("assignedTo").notNull(), // User ID
  taskType: varchar("taskType", { length: 100 }), // pickup, delivery, etc.
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "cancelled"]).default("pending").notNull(),
  notes: text("notes"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

/**
 * Payments table - tracks payment records
 */
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  moveId: int("moveId").notNull(),
  amount: int("amount").notNull(), // in cents
  paymentMethod: varchar("paymentMethod", { length: 100 }), // bank_transfer, cash, etc.
  paymentDate: timestamp("paymentDate"),
  notes: text("notes"),
  recordedBy: int("recordedBy").notNull(), // User ID
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

/**
 * Damages table - stores damage reports during moves
 */
export const damages = mysqlTable("damages", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull(),
  moveId: int("moveId").notNull(),
  customerId: int("customerId").notNull(),
  description: text("description").notNull(),
  estimatedCost: decimal("estimatedCost", { precision: 10, scale: 2 }),
  actualCost: decimal("actualCost", { precision: 10, scale: 2 }),
  status: mysqlEnum("status", ["reported", "assessed", "approved", "rejected", "paid"]).default("reported"),
  reportedBy: int("reportedBy"),
  reportedDate: timestamp("reportedDate").defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Damage = typeof damages.$inferSelect;
export type InsertDamage = typeof damages.$inferInsert;

/**
 * Complaints table - stores customer complaints
 */
export const complaints = mysqlTable("complaints", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull(),
  moveId: int("moveId").notNull(),
  customerId: int("customerId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium"),
  status: mysqlEnum("status", ["open", "in_progress", "resolved", "closed"]).default("open"),
  resolution: text("resolution"),
  submittedBy: int("submittedBy"),
  submittedDate: timestamp("submittedDate").defaultNow(),
  resolvedDate: timestamp("resolvedDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Complaint = typeof complaints.$inferSelect;
export type InsertComplaint = typeof complaints.$inferInsert;
/**
 * Invoices table - stores invoice records generated from moves
 */
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
  moveId: int("move_id").notNull(),
  customerId: int("customer_id").notNull(),
  branchId: int("branch_id"),
  customerName: varchar("customer_name", { length: 255 }),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  isPaid: int("is_paid").default(0), // 0 = unpaid, 1 = paid
  paymentMethod: varchar("payment_method", { length: 50 }), // Bank, Bar, Bank and Bar
  paymentDate: timestamp("payment_date"),
  generatedBy: int("generated_by"), // userId who generated
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;
