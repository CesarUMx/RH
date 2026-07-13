-- AlterTable: TipoDocumentoExpediente — añadir precisión de vigencia y condición de nacionalidad
ALTER TABLE "TipoDocumentoExpediente" ADD COLUMN "precisionVigencia" TEXT;
ALTER TABLE "TipoDocumentoExpediente" ADD COLUMN "condicion" TEXT;

-- AlterTable: RegistroIngreso — añadir flag de extranjero
ALTER TABLE "RegistroIngreso" ADD COLUMN "esExtranjero" BOOLEAN NOT NULL DEFAULT false;
