-- AI Assistant v2 — New feature tables

CREATE TABLE IF NOT EXISTS `prompt_templates` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `name` varchar(256) NOT NULL,
  `description` text,
  `systemPrompt` text NOT NULL,
  `tags` varchar(512),
  `isPublic` boolean NOT NULL DEFAULT false,
  `usageCount` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT NOW(),
  `updatedAt` timestamp NOT NULL DEFAULT NOW() ON UPDATE NOW()
);

CREATE TABLE IF NOT EXISTS `rag_documents` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `fileName` varchar(512) NOT NULL,
  `content` text NOT NULL,
  `chunkIndex` int NOT NULL DEFAULT 0,
  `embedding` json,
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS `benchmark_runs` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `prompt` text NOT NULL,
  `results` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS `image_generations` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `conversationId` int,
  `prompt` text NOT NULL,
  `provider` varchar(64) NOT NULL,
  `model` varchar(128),
  `imageUrl` text,
  `revisedPrompt` text,
  `size` varchar(32),
  `createdAt` timestamp NOT NULL DEFAULT NOW()
);
