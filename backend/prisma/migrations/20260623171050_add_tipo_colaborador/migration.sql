-- CreateEnum
CREATE TYPE "EstadoAlta" AS ENUM ('PENDIENTE', 'COMPLETO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "EstadoBaja" AS ENUM ('PENDIENTE', 'PROCESADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoDocumento" AS ENUM ('PENDIENTE', 'VERIFICADO', 'RECHAZADO', 'PROXIMO_A_VENCER', 'VENCIDO');

-- CreateEnum
CREATE TYPE "TipoColaborador" AS ENUM ('ADMINISTRATIVO', 'GUARDIA', 'LIMPIEZA_MANTENIMIENTO', 'DOCENTE');

-- CreateEnum
CREATE TYPE "EstadoCuenta" AS ENUM ('ACTIVA', 'SUSPENDIDA', 'ELIMINADA');

-- CreateTable
CREATE TABLE "SeccionExpediente" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SeccionExpediente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoDocumentoExpediente" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "seccion" TEXT,
    "requerido" BOOLEAN NOT NULL DEFAULT false,
    "requiereVigencia" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TipoDocumentoExpediente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoExpediente" (
    "id" SERIAL NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "tipoDocumentoId" INTEGER NOT NULL,
    "archivo" TEXT NOT NULL,
    "nombreOriginal" TEXT NOT NULL,
    "estado" "EstadoDocumento" NOT NULL DEFAULT 'PENDIENTE',
    "fechaVigencia" TIMESTAMP(3),
    "soloMesAnio" BOOLEAN NOT NULL DEFAULT false,
    "motivoRechazo" TEXT,
    "verificadoPorId" INTEGER,
    "verificadoEn" TIMESTAMP(3),
    "alertaProximaEnviada" BOOLEAN NOT NULL DEFAULT false,
    "alertaVencidoEnviada" BOOLEAN NOT NULL DEFAULT false,
    "archivoAnterior" TEXT,
    "nombreOriginalAnterior" TEXT,
    "fechaVigenciaAnterior" TIMESTAMP(3),
    "reemplazadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentoExpediente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contrato" (
    "id" SERIAL NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "archivo" TEXT NOT NULL,
    "nombreOriginal" TEXT NOT NULL,
    "subidoPorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudAlta" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "estadoAlta" "EstadoAlta" NOT NULL DEFAULT 'PENDIENTE',
    "motivoRechazo" TEXT,
    "creadorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SolicitudAlta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudDocumentos" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "constanciaFiscal" TEXT,
    "comprobanteDomicilio" TEXT,
    "cv" TEXT,
    "cuentaBancaria" TEXT,
    "ine" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SolicitudDocumentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudBaja" (
    "id" SERIAL NOT NULL,
    "docenteId" INTEGER NOT NULL,
    "motivoBaja" TEXT NOT NULL,
    "estadoBaja" "EstadoBaja" NOT NULL DEFAULT 'PENDIENTE',
    "creadorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SolicitudBaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Departamento" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "coordinadorId" INTEGER,

    CONSTRAINT "Departamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroIngreso" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoColaborador" NOT NULL DEFAULT 'ADMINISTRATIVO',
    "fechaNacimiento" TIMESTAMP(3) NOT NULL,
    "numColaborador" TEXT NOT NULL,
    "fechaIngreso" TIMESTAMP(3) NOT NULL,
    "puesto" TEXT NOT NULL,
    "archivoCredenciales" TEXT,
    "creadoPorId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroIngreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuentaInstitucional" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "correoInstitucional" TEXT NOT NULL,
    "departamentoId" INTEGER NOT NULL,
    "estado" "EstadoCuenta" NOT NULL DEFAULT 'ACTIVA',
    "creadoPorId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuentaInstitucional_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeccionExpediente_nombre_key" ON "SeccionExpediente"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "TipoDocumentoExpediente_nombre_key" ON "TipoDocumentoExpediente"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoExpediente_empleadoId_tipoDocumentoId_key" ON "DocumentoExpediente"("empleadoId", "tipoDocumentoId");

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudDocumentos_solicitudId_key" ON "SolicitudDocumentos"("solicitudId");

-- CreateIndex
CREATE UNIQUE INDEX "Departamento_nombre_key" ON "Departamento"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroIngreso_userId_key" ON "RegistroIngreso"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CuentaInstitucional_userId_key" ON "CuentaInstitucional"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CuentaInstitucional_correoInstitucional_key" ON "CuentaInstitucional"("correoInstitucional");

-- AddForeignKey
ALTER TABLE "DocumentoExpediente" ADD CONSTRAINT "DocumentoExpediente_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoExpediente" ADD CONSTRAINT "DocumentoExpediente_tipoDocumentoId_fkey" FOREIGN KEY ("tipoDocumentoId") REFERENCES "TipoDocumentoExpediente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudAlta" ADD CONSTRAINT "SolicitudAlta_creadorId_fkey" FOREIGN KEY ("creadorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudDocumentos" ADD CONSTRAINT "SolicitudDocumentos_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudAlta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudBaja" ADD CONSTRAINT "SolicitudBaja_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "Docente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudBaja" ADD CONSTRAINT "SolicitudBaja_creadorId_fkey" FOREIGN KEY ("creadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Departamento" ADD CONSTRAINT "Departamento_coordinadorId_fkey" FOREIGN KEY ("coordinadorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroIngreso" ADD CONSTRAINT "RegistroIngreso_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroIngreso" ADD CONSTRAINT "RegistroIngreso_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaInstitucional" ADD CONSTRAINT "CuentaInstitucional_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaInstitucional" ADD CONSTRAINT "CuentaInstitucional_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Departamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaInstitucional" ADD CONSTRAINT "CuentaInstitucional_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
