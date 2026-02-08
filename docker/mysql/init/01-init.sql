-- MYDON Database Initialization
-- This script runs automatically when MySQL container starts for the first time

-- Ensure proper character set
ALTER DATABASE mydon CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Grant additional privileges if needed
GRANT ALL PRIVILEGES ON mydon.* TO 'mydon'@'%';
FLUSH PRIVILEGES;

-- Log successful initialization
SELECT 'MYDON database initialized successfully' AS status;
