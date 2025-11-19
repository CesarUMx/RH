import nodemailer from 'nodemailer';
import { env } from '../config/env';

// Configuración del transporte de correo
let transporter: nodemailer.Transporter;

// Función para crear el transporter
function createTransporter() {
  try {
    // Verificar que las credenciales están configuradas
    if (!env.email.user || !env.email.password) {
      console.warn('Advertencia: Credenciales de correo no configuradas. Se usará un transporter de prueba.');
      
      // Crear una cuenta de prueba de ethereal.email
      return nodemailer.createTestAccount().then(testAccount => {
        console.log('Cuenta de prueba creada:', testAccount.user);
        
        // Crear un transporter de prueba
        return nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
      });
    }
    
    // Usar la configuración real
    return Promise.resolve(nodemailer.createTransport({
      host: env.email.host,
      port: env.email.port,
      secure: env.email.secure,
      auth: {
        user: env.email.user,
        pass: env.email.password,
      },
      // Opciones adicionales para mejorar el debugging
      logger: true, // Registrar actividad SMTP
      debug: process.env.NODE_ENV === 'development', // Mostrar debug solo en desarrollo
    }));
  } catch (error) {
    console.error('Error al crear transporter de correo:', error);
    throw error;
  }
}

// Inicializar el transporter
let transporterPromise = createTransporter();

// Interfaz para los parámetros de envío de correo
interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

// Función para enviar correos electrónicos
export async function sendEmail({ to, subject, html, from }: SendEmailParams): Promise<void> {
  try {
    // Asegurarse de que el transporter esté inicializado
    if (!transporter) {
      transporter = await transporterPromise;
    }
    
    // Enviar el correo
    const info = await transporter.sendMail({
      from: from || `Universidad Mondragón México <${env.email.user || 'noreply@example.com'}>`,
      to,
      subject,
      html,
    });
    
    console.log(`Correo enviado a: ${to}`);
    console.log('ID del mensaje:', info.messageId);
    
    // Si estamos usando una cuenta de prueba, mostrar la URL de vista previa
    if (info.preview) {
      console.log('URL de vista previa:', nodemailer.getTestMessageUrl(info));
    }
    
    return info;
  } catch (error) {
    console.error('Error detallado al enviar correo:', {
      to,
      subject,
      error: (error as any).message,
      stack: (error as any).stack,
      code: (error as any).code,
      command: (error as any).command,
      responseCode: (error as any).responseCode,
      response: (error as any).response
    });
    
    // Intentar recrear el transporter en caso de error de conexión
    if ((error as any).code === 'ECONNECTION' || (error as any).code === 'ETIMEDOUT') {
      console.log('Intentando recrear el transporter...');
      transporterPromise = createTransporter();
      transporter = await transporterPromise;
    }
    
    throw new Error(`Error al enviar correo electrónico: ${(error as any).message}`);
  }
}

// Plantillas de correo electrónico
export const emailTemplates = {
  // Plantilla para notificar aprobación de solicitud al coordinador
  solicitudAprobada: (nombreDocente: string): string => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <h2 style="color: #2c3e50; text-align: center;">Universidad Mondragón México</h2>
        <h3 style="color: #3498db;">Solicitud de Alta Aprobada</h3>
        <p>Estimado(a) Coordinador(a),</p>
        <p>Le informamos que su solicitud de alta para el docente <strong>${nombreDocente}</strong> ha sido <strong style="color: #27ae60;">APROBADA</strong> por el departamento de Recursos Humanos.</p>
        <p>El departamento de Recursos Humanos procederá con el registro del docente en el sistema.</p>
        <p>Una vez completado el proceso, el docente estará disponible para ser asignado a cursos desde el módulo de Docentes.</p>
        <p>Si tiene alguna pregunta, no dude en contactar al departamento de Recursos Humanos.</p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #7f8c8d; font-size: 12px;">
          <p>Este es un correo automático, por favor no responda a este mensaje.</p>
          <p>Universidad Mondragón México &copy; ${new Date().getFullYear()}</p>
        </div>
      </div>
    `;
  },

  // Plantilla para notificar rechazo de solicitud al coordinador
  solicitudRechazada: (nombreDocente: string, motivo: string): string => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <h2 style="color: #2c3e50; text-align: center;">Universidad Mondragón México</h2>
        <h3 style="color: #e74c3c;">Solicitud de Alta Rechazada</h3>
        <p>Estimado(a) Coordinador(a),</p>
        <p>Lamentamos informarle que su solicitud de alta para el docente <strong>${nombreDocente}</strong> ha sido <strong style="color: #e74c3c;">RECHAZADA</strong> por el departamento de Recursos Humanos.</p>
        <p><strong>Motivo del rechazo:</strong></p>
        <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #e74c3c; margin: 15px 0;">
          <p style="margin: 0;">${motivo}</p>
        </div>
        <p>Por favor, revise los documentos y la información proporcionada y realice una nueva solicitud con las correcciones necesarias.</p>
        <p>Si tiene alguna pregunta o requiere asistencia, por favor contacte al departamento de Recursos Humanos.</p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #7f8c8d; font-size: 12px;">
          <p>Este es un correo automático, por favor no responda a este mensaje.</p>
          <p>Universidad Mondragón México &copy; ${new Date().getFullYear()}</p>
        </div>
      </div>
    `;
  },

  // Plantilla para notificar solicitud de baja de docente a RH
  solicitudBaja: (nombreDocente: string, nombreCoordinador: string, motivoBaja: string): string => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <h2 style="color: #2c3e50; text-align: center;">Universidad Mondragón México</h2>
        <h3 style="color: #e74c3c;">Solicitud de Baja de Docente</h3>
        <p>Estimado(a) Departamento de Recursos Humanos,</p>
        <p>Se ha registrado una solicitud de baja para el docente <strong>${nombreDocente}</strong>.</p>
        <p><strong>Solicitada por:</strong> ${nombreCoordinador}</p>
        <p><strong>Motivo de la baja:</strong></p>
        <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #e74c3c; margin: 15px 0;">
          <p style="margin: 0;">${motivoBaja}</p>
        </div>
        <p>El docente ha sido marcado como inactivo en el sistema.</p>
        <p>Por favor, procese esta solicitud según los procedimientos establecidos.</p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #7f8c8d; font-size: 12px;">
          <p>Este es un correo automático, por favor no responda a este mensaje.</p>
          <p>Universidad Mondragón México &copy; ${new Date().getFullYear()}</p>
        </div>
      </div>
    `;
  }
};
