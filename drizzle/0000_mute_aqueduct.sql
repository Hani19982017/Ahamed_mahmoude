CREATE TABLE `additionalServices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`price` int,
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `additionalServices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`city` varchar(255) NOT NULL,
	`address` text,
	`phone` varchar(20),
	`email` varchar(320),
	`manager` int,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `branches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `complaints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`moveId` int NOT NULL,
	`customerId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`severity` enum('low','medium','high','critical') DEFAULT 'medium',
	`status` enum('open','in_progress','resolved','closed') DEFAULT 'open',
	`resolution` text,
	`submittedBy` int,
	`submittedDate` timestamp DEFAULT (now()),
	`resolvedDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `complaints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`title` varchar(50),
	`firstName` varchar(255) NOT NULL,
	`lastName` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(20),
	`company` varchar(255),
	`notes` text,
	`sitz` varchar(100),
	`status2` varchar(100),
	`versuch` varchar(50),
	`callCheck` varchar(10),
	`shaden` varchar(10),
	`angebotPerPost` int DEFAULT 0,
	`bezahlt` int DEFAULT 0,
	`mitFotos` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `damages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`moveId` int NOT NULL,
	`customerId` int NOT NULL,
	`description` text NOT NULL,
	`estimatedCost` decimal(10,2),
	`actualCost` decimal(10,2),
	`status` enum('reported','assessed','approved','rejected','paid') DEFAULT 'reported',
	`reportedBy` int,
	`reportedDate` timestamp DEFAULT (now()),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `damages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoice_number` varchar(50) NOT NULL,
	`move_id` int NOT NULL,
	`customer_id` int NOT NULL,
	`branch_id` int,
	`customer_name` varchar(255),
	`amount` decimal(10,2),
	`is_paid` int DEFAULT 0,
	`payment_method` varchar(50),
	`payment_date` timestamp,
	`generated_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messageHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`moveId` int NOT NULL,
	`templateId` int NOT NULL,
	`generatedContent` text NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`sentAt` timestamp,
	`sentBy` int,
	CONSTRAINT `messageHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messageTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`language` varchar(10) NOT NULL DEFAULT 'de',
	`subject` varchar(500),
	`content` text NOT NULL,
	`isDefault` int DEFAULT 0,
	`variables` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `messageTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `moveImages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`moveId` int NOT NULL,
	`imageUrl` text NOT NULL,
	`imageKey` varchar(500) NOT NULL DEFAULT '',
	`imageType` varchar(50) NOT NULL DEFAULT 'customer_photos',
	`uploadedBy` int NOT NULL DEFAULT 0,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `moveImages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `moves` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`customerId` int NOT NULL,
	`moveCode` varchar(50) NOT NULL,
	`pickupAddress` text NOT NULL,
	`pickupFloor` varchar(50),
	`pickupElevatorCapacity` varchar(100),
	`pickupParkingDistance` varchar(100),
	`deliveryAddress` text NOT NULL,
	`deliveryFloor` varchar(50),
	`deliveryElevatorCapacity` varchar(100),
	`deliveryParkingDistance` varchar(100),
	`pickupDate` timestamp NOT NULL,
	`deliveryDate` timestamp NOT NULL,
	`volume` int,
	`grossPrice` decimal(15,2),
	`distance` int,
	`numTrips` int DEFAULT 0,
	`moveType` varchar(100),
	`services` text,
	`auszugflaeche` int,
	`auszugzimmer` int,
	`einzugflaeche` int,
	`einzugzimmer` int,
	`anfahrt` int DEFAULT 0,
	`servicesjson` text,
	`summary` text,
	`anmerkungen` text,
	`serviceanmerkungen` text,
	`moebelliste` text,
	`kundennote` text,
	`kontaktinfo` text,
	`anzahlung` int,
	`restbetrag` int,
	`zahlungsart` varchar(100),
	`rechnungnr` varchar(100),
	`bewertungplatform` varchar(100),
	`bewertungscore` int,
	`bewertunglink` varchar(500),
	`planmitarbeiter` int,
	`planfahrzeuge` int,
	`planstartzeit` varchar(10),
	`planendzeit` varchar(10),
	`planbemerkungen` text,
	`schadenkosten` int,
	`schadenstatus` varchar(100),
	`beschwerdeschweregrad` varchar(50),
	`extravolumen` int,
	`extrapreis` int,
	`extrabemerkungen` text,
	`status` enum('pending','confirmed','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
	`paymentStatus` enum('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
	`assignedSupervisor` int,
	`assignedWorkers` text,
	`schaden_description` text,
	`schaden_images` text,
	`beschwerde_description` text,
	`beschwerde_images` text,
	`completed_at` timestamp,
	`bezahlt_von` varchar(100) DEFAULT 'Kunde',
	`betzhalkunde` varchar(200),
	`ist_bezahlt` int DEFAULT 0,
	`payment_way` varchar(50) DEFAULT 'Bank',
	`audit_total_price` int,
	`bezahlt_datum` timestamp,
	`bank_betrag` int,
	`bar_betrag` int,
	`rechnung_ausgestellt` int DEFAULT 0,
	`rechnung_betrag` int,
	`rechnung_nummer` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `moves_id` PRIMARY KEY(`id`),
	CONSTRAINT `moves_moveCode_unique` UNIQUE(`moveCode`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`moveId` int NOT NULL,
	`amount` int NOT NULL,
	`paymentMethod` varchar(100),
	`paymentDate` timestamp,
	`notes` text,
	`recordedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `revenueSummary` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`totalRevenue` decimal(12,2) DEFAULT '0',
	`totalMoves` int DEFAULT 0,
	`totalDamages` decimal(12,2) DEFAULT '0',
	`netRevenue` decimal(12,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `revenueSummary_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`moveId` int NOT NULL,
	`assignedTo` int NOT NULL,
	`taskType` varchar(100),
	`status` enum('pending','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
	`notes` text,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`username` varchar(100),
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('admin','branch_manager','supervisor','worker','sales') NOT NULL DEFAULT 'sales',
	`branchId` int,
	`passwordHash` varchar(255),
	`localEmail` varchar(320),
	`isLocalUser` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
