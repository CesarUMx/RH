import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

const loginSchema = z.object({
  correo: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const Login = () => {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      console.log('Iniciando sesión...');
      const response = await login(data.correo, data.password);
      console.log('Login exitoso, respuesta:', response);
      toast.success('Inicio de sesión exitoso');
      
      // Forzar la redirección usando window.location en lugar de navigate
      console.log('Redirigiendo con window.location...');
      window.location.href = '/';
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      toast.error('Credenciales incorrectas');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <img
              className="h-16 w-auto"
              src="/logo.svg"
              alt="Logo UMx"
            />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sistema de Recursos Humanos
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Inicia sesión para acceder al sistema
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div className="mb-4">
              <Input
                label="Correo electrónico"
                type="email"
                autoComplete="email"
                {...register('correo')}
                error={errors.correo?.message}
              />
            </div>
            <div>
              <Input
                label="Contraseña"
                type="password"
                autoComplete="current-password"
                {...register('password')}
                error={errors.password?.message}
              />
            </div>
          </div>

          <div>
            <Button
              type="submit"
              fullWidth
              isLoading={isLoading}
              className="group relative flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              Iniciar sesión
            </Button>
          </div>
        </form>
        <div className="mt-4 text-center">
          <div className="text-sm">
            <p className="text-gray-500">
              Universidad Mondragón México &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
