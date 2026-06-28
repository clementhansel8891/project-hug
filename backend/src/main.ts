import * as dotenv from "dotenv";

import path from "path";

// Load environment variables before anything else
const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });

import { NestFactory } from "@nestjs/core";
import { VersioningType } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module";

import { Rfc7807ExceptionFilter } from "./shared/filters/rfc7807.filter";
import { HttpLogInterceptor } from "./shared/logger/http-log.interceptor";
import { LoggerService } from "./shared/logger/logger.service";
import { DecimalSerializationInterceptor } from "./shared/interceptors/decimal.interceptor";

/**
 * Bootstrap the Zenvix Backend Application
 *
 * Configuration:
 * - RFC 7807 Standardized Error Responses
 * - Global ValidationPipe with whitelist and transform enabled
 * - CORS enabled for frontend communication
 * - Port 3001 (to avoid conflict with Vite dev server)
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Required for Stripe signature validation
  });

  // Increase body size limits
  const bodyParser = require("body-parser");
  app.use(bodyParser.json({ limit: "5gb" }));
  app.use(bodyParser.urlencoded({ limit: "5gb", extended: true }));

  const loggerService = app.get(LoggerService);
  
  // 1. Global Prefix (Disabled for frontend compatibility)
  // app.setGlobalPrefix("v1");

  // Enable URI Versioning to resolve /v1/ route prefix mismatch
  // This allows controllers to handle both /v1/inventory/... and /inventory/... routes
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: ['1', ''],
    prefix: 'v',
  });

  // 2. Enable Graceful Shutdown
  app.enableShutdownHooks();

  // 2. Global Interceptors
  app.useGlobalInterceptors(new HttpLogInterceptor(loggerService));
  app.useGlobalInterceptors(new DecimalSerializationInterceptor());

  // Global error logging for debugging
  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection:", reason);
  });


  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
  });

  // 1. Resilience & Health Check Middleware (Run before prefix)
  app.use((req: any, res: any, next: any) => {
    // Health Check at root or /v1/health
    if (req.url === "/" || req.url === "/v1/health" || req.url === "/api/health") {
      return res.status(200).json({
        status: "ok",
        uptime: process.uptime(),
        service: "zenvix-backend",
        mode: process.env.PERSISTENCE_MODE || "mock",
        timestamp: new Date().toISOString(),
      });
    }

    // ALWAYS Log
    console.log(
      `[REQUEST] ${req.method} ${req.url} | Origin: ${req.headers.origin}`,
    );

    const origin = req.headers.origin || "*";
    res.header("Access-Control-Allow-Origin", origin);

    res.header(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      return res.status(200).send();
    }

    next();
  });

  // 2. Security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
    }),
  );

  // 3. Normal NestJS CORS (as a fallback)
  app.enableCors({
    origin: [
      "http://localhost:8081",
      "http://localhost:8080",
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:3020",
      "http://150.109.15.108:3020",
      "https://bambusilver.netlify.app",
      "https://zenvix-demo-vbeta0000001a.vercel.app",
      /\.vercel\.app$/, // Allow all vercel preview deployments
      /\.railway\.app$/, // Allow all railway subdomains
    ],
    credentials: true,
  });



  // RFC 7807 Exception Filter
  app.useGlobalFilters(new Rfc7807ExceptionFilter());



  // Global validation pipe is registered via APP_PIPE in AppModule (GlobalValidationPipe)
  // This allows it to participate in NestJS dependency injection

  // Start server
  const port = parseInt(process.env.PORT || "3001", 10);
  await app.listen(port, "0.0.0.0");

  console.log("");
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║                                                        ║");
  console.log(
    process.env.PERSISTENCE_MODE === "db"
      ? "║   🚀 Zenvix Platform Backend - DB_PERSISTENCE         ║"
      : "║   🚀 Zenvix Platform Backend - MOCK_MODE              ║",
  );
  console.log("║                                                        ║");
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log(`║   Server running on: http://localhost:${port}           ║`);
  console.log(
    process.env.PERSISTENCE_MODE === "db"
      ? "║   Mode: Production (PostgreSQL Persistence)            ║"
      : "║   Mode: Development (Mock Repositories)                ║",
  );
  console.log("║   Multi-Tenancy: ENABLED (x-tenant-id required)        ║");
  console.log("║                                                        ║");
  console.log("║   Available Endpoints:                                 ║");
  console.log("║   • GET  /finance/ledger                               ║");
  console.log("║   • POST /finance/transactions                         ║");
  console.log("║   • GET  /finance/balance                              ║");
  console.log("║   • GET  /finance/transactions/:id                     ║");
  console.log("║                                                        ║");
  console.log("║   Test Tenants:                                        ║");
  console.log("║   • tenant-001 (Tech Startup)                          ║");
  console.log("║   • tenant-002 (Retail Chain)                          ║");
  console.log("║                                                        ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log("");
}

bootstrap();
