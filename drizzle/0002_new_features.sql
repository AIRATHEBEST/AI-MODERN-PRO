-- Prompt Templates
CREATE TABLE IF NOT EXISTS `prompt_templates` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `name` varchar(256) NOT NULL,
  `description` text,
  `systemPrompt` text NOT NULL,
  `userPrompt` text,
  `provider` varchar(64),
  `model` varchar(128),
  `tags` json,
  `isPublic` boolean NOT NULL DEFAULT false,
  `useCount` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT now(),
  `updatedAt` timestamp NOT NULL DEFAULT now() ON UPDATE now()
);

-- RAG Documents
CREATE TABLE IF NOT EXISTS `rag_documents` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `name` varchar(512) NOT NULL,
  `content` text NOT NULL,
  `chunkIndex` int NOT NULL DEFAULT 0,
  `totalChunks` int NOT NULL DEFAULT 1,
  `embedding` json,
  `metadata` json,
  `sourceFile` varchar(512),
  `createdAt` timestamp NOT NULL DEFAULT now()
);

-- Image Generations
CREATE TABLE IF NOT EXISTS `image_generations` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `conversationId` int,
  `prompt` text NOT NULL,
  `provider` varchar(64) NOT NULL,
  `model` varchar(128) NOT NULL,
  `imageUrl` text NOT NULL,
  `width` int,
  `height` int,
  `createdAt` timestamp NOT NULL DEFAULT now()
);

-- Benchmarks
CREATE TABLE IF NOT EXISTS `benchmarks` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `prompt` text NOT NULL,
  `results` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT now()
);

-- Add imageUrls to messages
ALTER TABLE `messages` ADD COLUMN IF NOT EXISTS `imageUrls` json;

-- Update usageLogs requestType enum
ALTER TABLE `usage_logs` MODIFY COLUMN `requestType` enum('chat','transcription','embedding','image_gen','code_exec') NOT NULL DEFAULT 'chat';
