import { Input, Checkbox } from "@heroui/react";
import { User, Mail, Phone, Calendar, Lock, KeyRound } from "lucide-react";

// ============================================
// Sub-componentes de cada Step del Wizard
// ============================================

type SetFn = <K extends keyof RegisterForm>(key: K, value: RegisterForm[K]) => void;

export type RegisterForm = {
    username: string;
    email: string;
    phone: string;
    birthDate: string;
    password: string;
    wantsMarketingEmail: boolean;
    wantsMarketingWhatsapp: boolean;
    acceptsTerms: boolean;
    otp: string;
};

export const REGISTER_INITIAL: RegisterForm = {
    username: "", email: "", phone: "", birthDate: "",
    password: "", wantsMarketingEmail: false,
    wantsMarketingWhatsapp: false, acceptsTerms: false, otp: "",
};

const ICON = "text-default-400";

export function StepUsername({ form, set }: { form: RegisterForm; set: SetFn }) {
    return (
        <Input
            label="Username" name="username" value={form.username}
            onValueChange={(v) => set("username", v)}
            placeholder="tu_usuario" variant="bordered" size="lg" isRequired
            startContent={<User size={18} className={ICON} />}
        />
    );
}

export function StepContact({ form, set }: { form: RegisterForm; set: SetFn }) {
    return (
        <div className="flex flex-col gap-4">
            <Input
                label="Email" name="email" type="email" value={form.email}
                onValueChange={(v) => set("email", v)}
                placeholder="tu@correo.com" variant="bordered" size="lg" isRequired
                startContent={<Mail size={18} className={ICON} />}
            />
            <Input
                label="Teléfono" name="phone" type="tel" value={form.phone}
                onValueChange={(v) => set("phone", v)}
                placeholder="+52 555 123 4567" variant="bordered" size="lg" isRequired
                startContent={<Phone size={18} className={ICON} />}
            />
        </div>
    );
}

export function StepSecurity({ form, set }: { form: RegisterForm; set: SetFn }) {
    return (
        <div className="flex flex-col gap-4">
            <Input
                label="Fecha de nacimiento" name="birthDate" type="date"
                value={form.birthDate} onValueChange={(v) => set("birthDate", v)}
                variant="bordered" size="lg" isRequired
                startContent={<Calendar size={18} className={ICON} />}
            />
            <Input
                label="Contraseña" name="password" type="password"
                value={form.password} onValueChange={(v) => set("password", v)}
                placeholder="Mínimo 6 caracteres" variant="bordered" size="lg" isRequired
                startContent={<Lock size={18} className={ICON} />}
            />
        </div>
    );
}

export function StepPreferences({ form, set }: { form: RegisterForm; set: SetFn }) {
    return (
        <div className="flex flex-col gap-4">
            <Checkbox size="lg" isSelected={form.wantsMarketingEmail}
                onValueChange={(v) => set("wantsMarketingEmail", v)}
                classNames={{ label: "text-sm" }}
            >
                Recibir ofertas por email
            </Checkbox>
            <Checkbox size="lg" isSelected={form.wantsMarketingWhatsapp}
                onValueChange={(v) => set("wantsMarketingWhatsapp", v)}
                classNames={{ label: "text-sm" }}
            >
                Recibir ofertas por WhatsApp
            </Checkbox>
            <Checkbox size="lg" isSelected={form.acceptsTerms}
                onValueChange={(v) => set("acceptsTerms", v)} color="success"
                classNames={{ label: "text-sm" }}
            >
                Acepto los términos y condiciones *
            </Checkbox>
        </div>
    );
}

export function StepOtp({ form, set }: { form: RegisterForm; set: SetFn }) {
    return (
        <Input
            label="Código OTP" name="otp" value={form.otp}
            onValueChange={(v) => set("otp", v)}
            placeholder="Ingresa 123456 para probar" variant="bordered"
            size="lg" isRequired maxLength={6}
            startContent={<KeyRound size={18} className={ICON} />}
            description="MVP: usa el código 123456"
        />
    );
}
