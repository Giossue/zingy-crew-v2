"use client";

import { useState, useTransition } from "react";
import { Button } from "@heroui/react";
import { ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { registerClientAction } from "@/modules/clients/actions";
import { useRouter } from "next/navigation";
import {
    type RegisterForm, REGISTER_INITIAL,
    StepUsername, StepContact, StepSecurity, StepPreferences, StepOtp,
} from "./RegisterSteps";

// ============================================
// Wizard de Registro Multi-paso (5 steps)
// ============================================

const STEP_TITLES = [
    "Elige tu username", "Datos de contacto",
    "Seguridad", "Preferencias", "Verificación OTP",
];

export function RegisterWizard() {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState<RegisterForm>(REGISTER_INITIAL);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const set = <K extends keyof RegisterForm>(key: K, value: RegisterForm[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const next = () => setStep((s) => Math.min(s + 1, 5));
    const back = () => setStep((s) => Math.max(s - 1, 1));

    const handleSubmit = () => {
        startTransition(async () => {
            const result = await registerClientAction(form);
            if (result.success) {
                toast.success("¡Registro exitoso! Bienvenido a Crew Zingy");
                router.push("/client/dashboard");
            } else {
                toast.error(result.error ?? "Error al registrar");
            }
        });
    };

    return (
        <div className="flex flex-col gap-5">
            {/* Progress */}
            <div className="flex items-center justify-between text-xs text-white/50">
                <span>Paso {step} de 5</span>
                <span>{STEP_TITLES[step - 1]}</span>
            </div>
            <div className="h-1 w-full rounded-full bg-white/10">
                <div
                    className="h-1 rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${(step / 5) * 100}%` }}
                />
            </div>

            {/* Step Content */}
            {step === 1 && <StepUsername form={form} set={set} />}
            {step === 2 && <StepContact form={form} set={set} />}
            {step === 3 && <StepSecurity form={form} set={set} />}
            {step === 4 && <StepPreferences form={form} set={set} />}
            {step === 5 && <StepOtp form={form} set={set} />}

            {/* Navigation */}
            <div className="flex gap-3">
                {step > 1 && (
                    <Button variant="flat" onPress={back} isDisabled={isPending}
                        startContent={<ArrowLeft size={16} />}
                    >
                        Atrás
                    </Button>
                )}
                {step < 5 ? (
                    <Button color="primary" className="ml-auto font-semibold" onPress={next}
                        endContent={<ArrowRight size={16} />}
                    >
                        Siguiente
                    </Button>
                ) : (
                    <Button color="success" className="ml-auto font-semibold"
                        onPress={handleSubmit} isLoading={isPending}
                        startContent={!isPending ? <Sparkles size={16} /> : undefined}
                    >
                        {isPending ? "Registrando..." : "Completar Registro"}
                    </Button>
                )}
            </div>
        </div>
    );
}
