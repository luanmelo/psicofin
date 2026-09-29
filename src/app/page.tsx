"use client";

import {
  Ban,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  LayoutDashboard,
  Lock,
  LogOut,
  Plus,
  Sparkles,
  Trash2,
  UserPlus,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import {
  FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import {
  createTherapySession,
  loadAuthenticatedWorkspace,
  persistOccurrenceStatus,
  removeTherapySession,
  updateTherapySession,
  type CompletionStore,
  type OccurrenceStatus,
  type SessionFrequency,
  type TherapySession,
  type WeekdayId,
} from "@/lib/supabase/workspace";

type ViewMode = "day" | "month";
type AuthMode = "signIn" | "signUp";

type SessionOccurrence = {
  id: string;
  dateKey: string;
  session: TherapySession;
  status?: OccurrenceStatus;
};

type SessionForm = {
  patientId: string | null;
  patientName: string;
  sessionTime: string;
  sessionValue: string;
  frequency: SessionFrequency;
  startDate: string;
};

const weekdays: Array<{ id: WeekdayId; label: string; shortLabel: string }> = [
  { id: "monday", label: "Segunda", shortLabel: "Seg" },
  { id: "tuesday", label: "Terca", shortLabel: "Ter" },
  { id: "wednesday", label: "Quarta", shortLabel: "Qua" },
  { id: "thursday", label: "Quinta", shortLabel: "Qui" },
  { id: "friday", label: "Sexta", shortLabel: "Sex" },
  { id: "saturday", label: "Sabado", shortLabel: "Sab" },
  { id: "sunday", label: "Domingo", shortLabel: "Dom" },
];

const weekdayNumbers: Record<WeekdayId, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const numberToWeekday: Record<number, WeekdayId> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

const frequencyLabels: Record<SessionFrequency, string> = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  once: "Avulsa",
};

const initialSessionForm: SessionForm = {
  patientId: null,
  patientName: "",
  sessionTime: "14:00",
  sessionValue: "",
  frequency: "weekly",
  startDate: formatDateKey(new Date()),
};

const hourOptions = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, "0"),
);

const minuteOptions = ["00", "15", "30", "45"];

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function getCurrentMonth() {
  const today = new Date();

  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function getTodayWeekday(): WeekdayId {
  return numberToWeekday[new Date().getDay()];
}

function getWeekdayLabel(weekday: WeekdayId) {
  return weekdays.find((day) => day.id === weekday)?.label ?? "";
}

function getMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  if (!year || monthNumber < 1 || monthNumber > 12) {
    return "mês atual";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthNumber - 1));
}

function getCompactMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  if (!year || monthNumber < 1 || monthNumber > 12) {
    return "Selecionar mês";
  }

  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
  }).format(new Date(year, monthNumber - 1));

  return `${monthLabel} ${year}`;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekdayFromDate(dateKey: string) {
  return numberToWeekday[parseDateKey(dateKey).getDay()];
}

function formatShortDate(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${day}/${month}`;
}

function daysBetween(startDateKey: string, endDateKey: string) {
  const startDate = parseDateKey(startDateKey).getTime();
  const endDate = parseDateKey(endDateKey).getTime();
  return Math.round((endDate - startDate) / 86400000);
}

function getAnchorDate(startDateKey: string, weekday: WeekdayId) {
  const date = parseDateKey(startDateKey);

  while (date.getDay() !== weekdayNumbers[weekday]) {
    date.setDate(date.getDate() + 1);
  }

  return formatDateKey(date);
}

function getSessionDatesForMonth(session: TherapySession, month: string) {
  if (session.frequency === "once") {
    return session.startDate.startsWith(month) ? [session.startDate] : [];
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1, 1);
  const dates: string[] = [];
  const anchorDate = getAnchorDate(session.startDate, session.weekday);

  while (date.getMonth() === monthNumber - 1) {
    const dateKey = formatDateKey(date);
    const isSameWeekday = date.getDay() === weekdayNumbers[session.weekday];
    const isAfterStart = dateKey >= anchorDate;
    const distance = daysBetween(anchorDate, dateKey);
    const matchesFrequency =
      session.frequency === "weekly" || distance % 14 === 0;

    if (isSameWeekday && isAfterStart && matchesFrequency) {
      dates.push(dateKey);
    }

    date.setDate(date.getDate() + 1);
  }

  return dates;
}

function formatCurrency(value: number, showValues: boolean) {
  return showValues ? currencyFormatter.format(value) : "R$ ----";
}

function getTimeParts(time: string) {
  const [hour = "14", minute = "00"] = time.split(":");

  return {
    hour: hour.padStart(2, "0"),
    minute: minute.padStart(2, "0"),
  };
}

function getCompletionKey(sessionId: string, dateKey: string) {
  return `${dateKey}:${sessionId}`;
}

function buildOccurrences(
  sessions: TherapySession[],
  month: string,
  completions: CompletionStore,
) {
  return sessions
    .flatMap((session) =>
      getSessionDatesForMonth(session, month).map((dateKey) => ({
        id: getCompletionKey(session.id, dateKey),
        dateKey,
        session,
        status: completions[getCompletionKey(session.id, dateKey)],
      })),
    )
    .sort((first, second) => {
      const dateComparison = first.dateKey.localeCompare(second.dateKey);
      if (dateComparison !== 0) {
        return dateComparison;
      }

      return first.session.sessionTime.localeCompare(
        second.session.sessionTime,
      );
    });
}

function summarizeOccurrences(occurrences: SessionOccurrence[]) {
  return occurrences.reduce(
    (summary, occurrence) => {
      const value = occurrence.session.sessionValue;

      return {
        planned: summary.planned + value,
        realized:
          summary.realized +
          (occurrence.status === "completed" || occurrence.status === "missed"
            ? value
            : 0),
        pending:
          summary.pending + (!occurrence.status ? value : 0),
        plannedSessions: summary.plannedSessions + 1,
        completedSessions:
          summary.completedSessions +
          (occurrence.status === "completed" ? 1 : 0),
        missedSessions:
          summary.missedSessions + (occurrence.status === "missed" ? 1 : 0),
        cancelledSessions:
          summary.cancelledSessions +
          (occurrence.status === "cancelled" ? 1 : 0),
        pendingSessions: summary.pendingSessions + (!occurrence.status ? 1 : 0),
      };
    },
    {
      planned: 0,
      realized: 0,
      pending: 0,
      plannedSessions: 0,
      completedSessions: 0,
      missedSessions: 0,
      cancelledSessions: 0,
      pendingSessions: 0,
    },
  );
}

export default function Home() {
  const [isReady, setIsReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signIn");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [dataError, setDataError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [selectedWeekday, setSelectedWeekday] =
    useState<WeekdayId>(getTodayWeekday);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [sessions, setSessions] = useState<TherapySession[]>([]);
  const [completions, setCompletions] = useState<CompletionStore>({});
  const [sessionForm, setSessionForm] =
    useState<SessionForm>(initialSessionForm);
  const [showValues, setShowValues] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const formSectionRef = useRef<HTMLElement | null>(null);
  const monthInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let isActive = true;

    async function initializeSupabaseSession() {
      if (!isSupabaseConfigured) {
        setIsReady(true);
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();

        if (!isActive) {
          return;
        }

        if (error) {
          setAuthError("Não foi possível restaurar sua sessão.");
          return;
        }

        const user = data.session?.user;

        if (user) {
          const workspace = await loadAuthenticatedWorkspace(user);

          if (!isActive) {
            return;
          }

          setCurrentUserId(user.id);
          setSessionEmail(user.email ?? "");
          setAccountName(workspace.accountName);
          setSessions(workspace.sessions);
          setCompletions(workspace.completions);
        }
      } catch (sessionError) {
        if (isActive) {
          setAuthError(
            sessionError instanceof Error
              ? sessionError.message
              : "Não foi possível restaurar sua sessão.",
          );
        }
      } finally {
        if (isActive) {
          setIsReady(true);
        }
      }
    }

    void initializeSupabaseSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setCurrentUserId(null);
        setSessionEmail(null);
        setAccountName("");
        setSessions([]);
        setCompletions({});
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  const allOccurrences = useMemo(
    () => buildOccurrences(sessions, selectedMonth, completions),
    [completions, selectedMonth, sessions],
  );

  const occurrencesByWeekday = useMemo(() => {
    return weekdays.reduce(
      (accumulator, weekday) => {
        accumulator[weekday.id] = allOccurrences.filter(
          (occurrence) => occurrence.session.weekday === weekday.id,
        );
        return accumulator;
      },
      {} as Record<WeekdayId, SessionOccurrence[]>,
    );
  }, [allOccurrences]);

  const selectedOccurrences = useMemo(
    () => occurrencesByWeekday[selectedWeekday] ?? [],
    [occurrencesByWeekday, selectedWeekday],
  );

  const totals = useMemo(
    () => summarizeOccurrences(allOccurrences),
    [allOccurrences],
  );

  const selectedDaySessions = useMemo(
    () =>
      sessions
        .filter(
          (session) =>
            session.weekday === selectedWeekday &&
            (session.frequency !== "once" ||
              session.startDate.startsWith(selectedMonth)),
        )
        .sort((first, second) =>
          first.sessionTime.localeCompare(second.sessionTime),
        ),
    [selectedMonth, selectedWeekday, sessions],
  );

  const isSignUp = authMode === "signUp";
  const isEditing = Boolean(editingSessionId);
  const completionRate = allOccurrences.length
    ? Math.round((totals.completedSessions / allOccurrences.length) * 100)
    : 0;

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");

    if (!isSupabaseConfigured) {
      setAuthError("Configure as variáveis do Supabase para continuar.");
      return;
    }

    if (isSignUp && fullName.trim().length < 2) {
      setAuthError("Informe o nome do psicólogo.");
      return;
    }

    if (!email.trim() || password.length < 8) {
      setAuthError("Informe um email e uma senha com pelo menos 8 caracteres.");
      return;
    }

    setIsAuthenticating(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const authResult = isSignUp
        ? await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: {
              data: { full_name: fullName.trim() },
            },
          })
        : await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

      if (authResult.error) {
        setAuthError(authResult.error.message);
        return;
      }

      if (!authResult.data.session || !authResult.data.user) {
        setAuthMessage(
          "Cadastro realizado. Confirme o email enviado pelo Supabase antes de entrar.",
        );
        setAuthMode("signIn");
        setPassword("");
        return;
      }

      const workspace = await loadAuthenticatedWorkspace(authResult.data.user);
      setCurrentUserId(authResult.data.user.id);
      setSessionEmail(authResult.data.user.email ?? normalizedEmail);
      setAccountName(workspace.accountName);
      setSessions(workspace.sessions);
      setCompletions(workspace.completions);
      setPassword("");
      setDataError("");
    } catch (authSubmitError) {
      setAuthError(
        authSubmitError instanceof Error
          ? authSubmitError.message
          : "Não foi possível concluir o acesso.",
      );
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setCurrentUserId(null);
    setSessionEmail(null);
    setAccountName("");
    setSessions([]);
    setCompletions({});
    setEmail("");
    setPassword("");
  }

  function resetSessionForm() {
    setSessionForm({
      ...initialSessionForm,
      startDate: formatDateKey(new Date()),
    });
    setEditingSessionId(null);
  }

  function scrollToSessionForm() {
    window.setTimeout(() => {
      formSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function openNewSessionForm() {
    resetSessionForm();
    setIsFormOpen(true);
    scrollToSessionForm();
  }

  function openMonthPicker() {
    const monthInput = monthInputRef.current;

    if (!monthInput) {
      return;
    }

    if (typeof monthInput.showPicker === "function") {
      monthInput.showPicker();
      return;
    }

    monthInput.focus();
    monthInput.click();
  }

  async function handleSessionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDataError("");

    const sessionValue = Number(sessionForm.sessionValue);

    if (
      !sessionForm.patientName.trim() ||
      !sessionForm.sessionTime ||
      !sessionForm.startDate ||
      Number.isNaN(sessionValue) ||
      sessionValue <= 0
    ) {
      return;
    }

    if (!currentUserId) {
      setDataError("Sua sessão expirou. Entre novamente para continuar.");
      return;
    }

    const weekday =
      sessionForm.frequency === "once"
        ? getWeekdayFromDate(sessionForm.startDate)
        : selectedWeekday;
    const sessionInput = {
      patientId: sessionForm.patientId,
      patientName: sessionForm.patientName.trim(),
      sessionTime: sessionForm.sessionTime,
      sessionValue,
      frequency: sessionForm.frequency,
      weekday,
      startDate: sessionForm.startDate,
    };

    setIsSavingSession(true);

    try {
      if (editingSessionId) {
        await updateTherapySession(
          currentUserId,
          editingSessionId,
          sessionInput,
        );
        setSessions((currentSessions) =>
          currentSessions.map((session) =>
            session.id === editingSessionId
              ? {
                  ...session,
                  patientId: sessionForm.patientId ?? session.patientId,
                  weekday,
                  patientName: sessionInput.patientName,
                  sessionTime: sessionInput.sessionTime,
                  sessionValue,
                  frequency: sessionInput.frequency,
                  startDate: sessionInput.startDate,
                }
              : session,
          ),
        );
      } else {
        const newSession = await createTherapySession(
          currentUserId,
          sessionInput,
        );
        setSessions((currentSessions) => [...currentSessions, newSession]);
      }

      setSelectedWeekday(weekday);
      setViewMode("day");
      resetSessionForm();
      setIsFormOpen(false);
    } catch (sessionError) {
      setDataError(
        sessionError instanceof Error
          ? sessionError.message
          : "Não foi possível salvar a sessão.",
      );
    } finally {
      setIsSavingSession(false);
    }
  }

  function editSession(session: TherapySession) {
    setSelectedWeekday(session.weekday);
    setSessionForm({
      patientId: session.patientId,
      patientName: session.patientName,
      sessionTime: session.sessionTime,
      sessionValue: String(session.sessionValue),
      frequency: session.frequency,
      startDate: session.startDate,
    });
    setEditingSessionId(session.id);
    setIsFormOpen(true);
    scrollToSessionForm();
  }

  function addOneOffSessionForPatient(session: TherapySession) {
    const defaultDate = selectedMonth === getCurrentMonth()
      ? formatDateKey(new Date())
      : `${selectedMonth}-01`;

    setSelectedWeekday(getWeekdayFromDate(defaultDate));
    setSessionForm({
      patientId: session.patientId,
      patientName: session.patientName,
      sessionTime: session.sessionTime,
      sessionValue: String(session.sessionValue),
      frequency: "once",
      startDate: defaultDate,
    });
    setEditingSessionId(null);
    setIsFormOpen(true);
    scrollToSessionForm();
  }

  async function setOccurrenceStatus(
    sessionId: string,
    dateKey: string,
    status: OccurrenceStatus,
  ) {
    if (!currentUserId) {
      setDataError("Sua sessão expirou. Entre novamente para continuar.");
      return;
    }

    const completionKey = getCompletionKey(sessionId, dateKey);
    const currentStatus = completions[completionKey];

    try {
      const persistedStatus = await persistOccurrenceStatus({
        userId: currentUserId,
        sessionId,
        dateKey,
        currentStatus,
        nextStatus: status,
      });

      setCompletions((currentCompletions) => {
        const nextCompletions = { ...currentCompletions };

        if (persistedStatus) {
          nextCompletions[completionKey] = persistedStatus;
        } else {
          delete nextCompletions[completionKey];
        }

        return nextCompletions;
      });
      setDataError("");
    } catch (occurrenceError) {
      setDataError(
        occurrenceError instanceof Error
          ? occurrenceError.message
          : "Não foi possível atualizar o atendimento.",
      );
    }
  }

  async function deleteSession(sessionId: string) {
    if (!currentUserId) {
      setDataError("Sua sessão expirou. Entre novamente para continuar.");
      return;
    }

    try {
      await removeTherapySession(currentUserId, sessionId);
      setSessions((currentSessions) =>
        currentSessions.filter((session) => session.id !== sessionId),
      );
      setCompletions((currentCompletions) =>
        Object.fromEntries(
          Object.entries(currentCompletions).filter(
            ([completionKey]) => !completionKey.endsWith(`:${sessionId}`),
          ),
        ),
      );

      if (editingSessionId === sessionId) {
        resetSessionForm();
      }
      setDataError("");
    } catch (deleteError) {
      setDataError(
        deleteError instanceof Error
          ? deleteError.message
          : "Não foi possível excluir a sessão.",
      );
    }
  }

  if (!isReady) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f3f7f5] px-6 text-[#18332f]">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#183f38] text-white shadow-lg shadow-[#183f38]/15">
            <WalletCards size={26} aria-hidden="true" />
          </div>
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#dce8e4]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[#2b8a78]" />
          </div>
        </div>
      </main>
    );
  }

  if (!sessionEmail) {
    return (
      <main className="min-h-dvh bg-[#f3f7f5] text-[#18332f] lg:grid lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative hidden overflow-hidden bg-[#153d36] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20 xl:py-14">
          <div className="soft-orb soft-orb-one" />
          <div className="soft-orb soft-orb-two" />

          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#1f7566] shadow-xl shadow-black/10">
              <WalletCards size={24} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight">PsicoFin</p>
              <p className="text-sm text-white/60">Gestão para Psicólogos</p>
            </div>
          </div>

          <div className="relative max-w-xl">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur">
              <Sparkles size={16} aria-hidden="true" />
              Sua rotina financeira, mais leve
            </span>
            <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.04em] xl:text-6xl">
              Cuide da agenda. Nós organizamos os números.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-white/65">
              Sessões, recebimentos e visão mensal reunidos em um painel simples
              para você focar no que realmente importa.
            </p>
          </div>

          <div className="relative grid max-w-xl grid-cols-3 gap-3">
            {[
              ["Agenda", "organizada"],
              ["Financeiro", "em dia"],
              ["Dados", "sincronizados"],
            ].map(([title, detail]) => (
              <div
                className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur"
                key={title}
              >
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-xs text-white/55">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-dvh items-center justify-center px-5 py-10 sm:px-10 lg:bg-white">
          <div className="w-full max-w-md">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#183f38] text-white shadow-lg shadow-[#183f38]/15">
                <WalletCards size={22} aria-hidden="true" />
              </div>
              <div>
                <p className="text-xl font-bold tracking-tight">PsicoFin</p>
                <p className="text-sm text-[#6e817d]">Gestão para psicólogos</p>
              </div>
            </div>

            <div className="mb-8">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f4f0] text-[#247866]">
                <Lock size={20} aria-hidden="true" />
              </span>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#17332e]">
                {isSignUp ? "Crie seu acesso" : "Que bom ter você por aqui"}
              </h2>
              <p className="mt-3 leading-6 text-[#6e817d]">
                {isSignUp
                  ? "Cadastre seus dados para sincronizar sua agenda com segurança."
                  : "Entre para acessar sua agenda e acompanhar o mês."}
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleAuthSubmit}>
              {isSignUp ? (
                <label className="block">
                  <span className="text-sm font-semibold text-[#38524d]">
                    Nome do psicólogo
                  </span>
                  <input
                    className="field-control mt-2"
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Ex.: Ana Souza"
                  />
                </label>
              ) : null}

              <label className="block">
                <span className="text-sm font-semibold text-[#38524d]">
                  Email
                </span>
                <input
                  className="field-control mt-2"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@clinica.com"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[#38524d]">
                  Senha
                </span>
                <div className="field-control mt-2 flex p-0 focus-within:border-[#2b8a78] focus-within:ring-4 focus-within:ring-[#2b8a78]/10">
                  <input
                    className="min-w-0 flex-1 bg-transparent px-4 outline-none"
                    type={showPassword ? "text" : "password"}
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Mínimo de 8 caracteres"
                  />
                  <button
                    className="flex w-12 items-center justify-center text-[#71847f] transition hover:text-[#247866]"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </label>

              {authError ? (
                <p className="rounded-xl border border-[#f2d8c8] bg-[#fff7f1] px-4 py-3 text-sm text-[#9b4b22]">
                  {authError}
                </p>
              ) : null}

              {authMessage ? (
                <p className="rounded-xl border border-[#cde6de] bg-[#f0f8f5] px-4 py-3 text-sm text-[#276a5c]">
                  {authMessage}
                </p>
              ) : null}

              {!isSupabaseConfigured ? (
                <p className="rounded-xl border border-[#ead9b8] bg-[#fff9eb] px-4 py-3 text-sm leading-5 text-[#835f22]">
                  Supabase ainda não configurado. Preencha o arquivo{" "}
                  <code className="font-mono text-xs">.env.local</code> para
                  habilitar cadastro e login.
                </p>
              ) : null}

              <button
                className="primary-button h-13 w-full"
                type="submit"
                disabled={isAuthenticating || !isSupabaseConfigured}
              >
                <Lock size={18} aria-hidden="true" />
                {isAuthenticating
                  ? "Validando..."
                  : isSignUp
                    ? "Criar meu acesso"
                    : "Entrar no PsicoFin"}
              </button>
            </form>

            <button
              className="mx-auto mt-5 block text-sm font-semibold text-[#247866] transition hover:text-[#195f52]"
              type="button"
              onClick={() => {
                setAuthMode((current) =>
                  current === "signIn" ? "signUp" : "signIn",
                );
                setAuthError("");
                setAuthMessage("");
              }}
            >
              {isSignUp
                ? "Já possui uma conta? Entrar"
                : "Ainda não possui conta? Criar acesso"}
            </button>

            <p className="mt-5 text-center text-xs leading-5 text-[#83938f]">
              Senha protegida e dados sincronizados entre seus dispositivos.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell min-h-dvh text-[#18332f] lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col bg-[#153d36] px-5 py-6 text-white lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#247866] shadow-lg shadow-black/10">
            <WalletCards size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">PsicoFin</p>
            <p className="text-xs text-white/50">Gestão Inteligente</p>
          </div>
        </div>

        <nav className="mt-10 space-y-2" aria-label="Navegação principal">
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">
            Menu
          </p>
          <button
            className={`sidebar-link ${viewMode === "day" ? "sidebar-link-active" : ""}`}
            type="button"
            onClick={() => setViewMode("day")}
          >
            <LayoutDashboard size={19} aria-hidden="true" />
            Agenda
          </button>
          <button
            className={`sidebar-link ${viewMode === "month" ? "sidebar-link-active" : ""}`}
            type="button"
            onClick={() => setViewMode("month")}
          >
            <CalendarDays size={19} aria-hidden="true" />
            Visão mensal
          </button>
        </nav>

        <button
          className="mt-7 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#e7ad62] px-4 font-bold text-[#2f2a20] shadow-lg shadow-black/10 transition hover:bg-[#f0bd7a]"
          type="button"
          onClick={openNewSessionForm}
        >
          <UserPlus size={19} aria-hidden="true" />
          Nova sessão
        </button>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/55">Progresso do mês</span>
            <span className="font-bold">{completionRate}%</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#e7ad62] transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <p className="mt-3 text-xs leading-5 text-white/45">
            {totals.completedSessions} de {allOccurrences.length} sessões
            concluídas
          </p>
        </div>

        <div className="mt-auto border-t border-white/10 pt-5">
          <div className="flex items-center gap-3 px-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold">
              {accountName.charAt(0) || "P"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{accountName}</p>
              <p className="truncate text-xs text-white/45">{sessionEmail}</p>
            </div>
            <button
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
              type="button"
              onClick={handleLogout}
              aria-label="Sair"
              title="Sair"
            >
              <LogOut size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 pb-28 lg:pb-0">
        <header className="sticky top-0 z-30 border-b border-[#dfe9e5] bg-white/90 backdrop-blur-xl">
          <div className="mx-auto flex h-17 max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6 lg:h-20 lg:px-10">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#183f38] text-white">
                <WalletCards size={20} aria-hidden="true" />
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate font-bold tracking-tight">PsicoFin</p>
                <p className="truncate text-xs text-[#71847f]">Olá, {accountName}</p>
              </div>
            </div>

            <div className="hidden lg:block">
              <p className="text-sm font-semibold text-[#18332f]">
                Agenda financeira
              </p>
              <p className="mt-0.5 text-xs text-[#71847f]">
                Sessões e recebimentos em um só lugar
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="month-control">
                <button
                  className="month-control-trigger"
                  type="button"
                  onClick={openMonthPicker}
                  aria-label={`Selecionar mês. Atual: ${getMonthLabel(selectedMonth)}`}
                >
                  <CalendarDays size={17} aria-hidden="true" />
                  <span className="month-control-label">
                    {getCompactMonthLabel(selectedMonth)}
                  </span>
                </button>
                <input
                  ref={monthInputRef}
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => {
                    const nextMonth = event.currentTarget.value;

                    if (!nextMonth) {
                      event.currentTarget.value = selectedMonth;
                      return;
                    }

                    setSelectedMonth(nextMonth);
                  }}
                  tabIndex={-1}
                  aria-hidden="true"
                />
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setShowValues((current) => !current)}
                title={showValues ? "Esconder valores" : "Mostrar valores"}
                aria-label={showValues ? "Esconder valores" : "Mostrar valores"}
              >
                {showValues ? (
                  <EyeOff size={17} aria-hidden="true" />
                ) : (
                  <Eye size={17} aria-hidden="true" />
                )}
              </button>
              <button
                className="icon-button mobile-header-action"
                type="button"
                onClick={handleLogout}
                title="Sair"
                aria-label="Sair"
              >
                <LogOut size={17} aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
          <section className="mb-6 flex items-end justify-between gap-4">
            <div>
              <span className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[#2b806f]">
                <Sparkles size={16} aria-hidden="true" />
                Seu espaço de trabalho
              </span>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#15352f] sm:text-4xl">
                Olá, {accountName.split(" ")[0]}
              </h1>
              <p className="mt-2 text-sm leading-6 text-[#71847f] sm:text-base">
                Acompanhe sua agenda e o financeiro de {getMonthLabel(selectedMonth)}.
              </p>
            </div>
            <div className="hidden lg:block">
              <button
                className="primary-button"
                type="button"
                onClick={openNewSessionForm}
              >
                <Plus size={18} aria-hidden="true" />
                Nova sessão
              </button>
            </div>
          </section>

          {dataError ? (
            <div className="mb-6 flex items-start justify-between gap-3 rounded-2xl border border-[#f0d5c7] bg-[#fff7f2] px-4 py-3 text-sm text-[#964b2d]">
              <span>{dataError}</span>
              <button
                className="shrink-0"
                type="button"
                onClick={() => setDataError("")}
                aria-label="Fechar aviso"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
          ) : null}

          <section className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <DashboardMetric
              icon={<CircleDollarSign size={20} aria-hidden="true" />}
              label="Previsto"
              value={totals.planned}
              detail={`${totals.plannedSessions} sessões no mês`}
              showValues={showValues}
            />
            <DashboardMetric
              icon={<CheckCircle2 size={20} aria-hidden="true" />}
              label="Realizado"
              value={totals.realized}
              detail={`${totals.completedSessions + totals.missedSessions} cobradas`}
              showValues={showValues}
              highlight
            />
            <DashboardMetric
              icon={<Clock size={20} aria-hidden="true" />}
              label="Pendente"
              value={totals.pending}
              detail={`${totals.pendingSessions} aguardando`}
              showValues={showValues}
            />
            <div className="metric-card col-span-2 xl:col-span-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="metric-label">Ritmo do mês</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-[#173a33]">
                    {completionRate}%
                  </p>
                </div>
                <span className="metric-icon bg-[#fff3e3] text-[#ae6c22]">
                  <CalendarCheck size={20} aria-hidden="true" />
                </span>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#e8efec]">
                <div
                  className="h-full rounded-full bg-[#e3a558] transition-all"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>
          </section>

          {viewMode === "day" ? (
            <nav
              className="weekday-scroll mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-[#dfe9e5] bg-white p-2 shadow-sm shadow-[#16483c]/[0.03]"
              aria-label="Dias da semana"
            >
              {weekdays.map((weekday) => {
                const dayOccurrences = occurrencesByWeekday[weekday.id] ?? [];
                const completedCount = dayOccurrences.filter(
                  (occurrence) => occurrence.status === "completed",
                ).length;
                const missedCount = dayOccurrences.filter(
                  (occurrence) => occurrence.status === "missed",
                ).length;
                const cancelledCount = dayOccurrences.filter(
                  (occurrence) => occurrence.status === "cancelled",
                ).length;
                const isSelected = selectedWeekday === weekday.id;

                return (
                  <button
                    className={`min-w-[92px] flex-1 rounded-xl px-3 py-3 text-left transition ${
                      isSelected
                        ? "bg-[#183f38] text-white shadow-md shadow-[#183f38]/15"
                        : "text-[#627773] hover:bg-[#f1f7f4] hover:text-[#225e52]"
                    }`}
                    key={weekday.id}
                    type="button"
                    onClick={() => {
                      setSelectedWeekday(weekday.id);
                      setViewMode("day");
                    }}
                  >
                    <span className="block text-sm font-bold tracking-tight">
                      {weekday.shortLabel}
                    </span>
                    <span
                      className={`mt-1 block text-[11px] ${isSelected ? "text-white/60" : "text-[#92a19e]"}`}
                    >
                      {completedCount}/{dayOccurrences.length} feitas
                      {missedCount ? `, ${missedCount} faltas` : ""}
                      {cancelledCount
                        ? `, ${cancelledCount} canceladas`
                        : ""}
                    </span>
                  </button>
                );
              })}
            </nav>
          ) : null}

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="min-w-0">
              {viewMode === "day" ? (
                <DayView
                  occurrences={selectedOccurrences}
                  selectedWeekday={selectedWeekday}
                  sessions={selectedDaySessions}
                  showValues={showValues}
                  onDeleteSession={deleteSession}
                  onAddOneOffSession={addOneOffSessionForPatient}
                  onEditSession={editSession}
                  onSetOccurrenceStatus={setOccurrenceStatus}
                />
              ) : (
                <MonthView
                  month={selectedMonth}
                  occurrences={allOccurrences}
                  showValues={showValues}
                  onSetOccurrenceStatus={setOccurrenceStatus}
                />
              )}
            </section>

            <aside className="space-y-5 xl:sticky xl:top-28">
              <section
                className="surface-card scroll-mt-24 overflow-hidden"
                ref={formSectionRef}
              >
                <button
                  className="flex w-full items-center justify-between gap-3 px-5 py-5 text-left"
                  type="button"
                  onClick={() => setIsFormOpen((current) => !current)}
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f4f0] text-[#247866]">
                      <UserPlus size={20} aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block font-bold text-[#183a33]">
                        {isEditing ? "Editar sessão" : "Nova sessão"}
                      </span>
                      <span className="mt-1 block text-xs text-[#71847f]">
                        {sessionForm.frequency === "once"
                          ? "Atendimento avulso"
                          : `${getWeekdayLabel(selectedWeekday)} · ${frequencyLabels[sessionForm.frequency]}`}
                      </span>
                    </span>
                  </span>
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl bg-[#f1f6f4] text-[#59706b] transition ${
                      isFormOpen ? "rotate-180" : ""
                    }`}
                  >
                    <ChevronDown size={18} aria-hidden="true" />
                  </span>
                </button>

                {isFormOpen ? (
                  <form
                    className="space-y-4 border-t border-[#e5ece9] px-5 py-5"
                    onSubmit={handleSessionSubmit}
                  >
                    <label className="block">
                      <span className="field-label">Paciente</span>
                      <input
                        className="field-control mt-2"
                        value={sessionForm.patientName}
                        onChange={(event) =>
                          setSessionForm((current) => ({
                            ...current,
                            patientName: event.target.value,
                          }))
                        }
                        placeholder="Ex.: Ana Silva"
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      <TimeSelect
                        value={sessionForm.sessionTime}
                        onChange={(sessionTime) =>
                          setSessionForm((current) => ({
                            ...current,
                            sessionTime,
                          }))
                        }
                      />

                      <label className="block">
                        <span className="field-label">Valor</span>
                        <input
                          className="field-control mt-2"
                          type="number"
                          min="0"
                          step="0.01"
                          value={sessionForm.sessionValue}
                          onChange={(event) =>
                            setSessionForm((current) => ({
                              ...current,
                              sessionValue: event.target.value,
                            }))
                          }
                          placeholder="180,00"
                        />
                      </label>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      <label className="block">
                        <span className="field-label">Frequência</span>
                        <select
                          className="field-control mt-2"
                          value={sessionForm.frequency}
                          onChange={(event) =>
                            setSessionForm((current) => ({
                              ...current,
                              frequency: event.target.value as SessionFrequency,
                            }))
                          }
                        >
                          <option value="weekly">Semanal</option>
                          <option value="biweekly">Quinzenal</option>
                          <option value="once">Avulsa</option>
                        </select>
                      </label>

                      <label className="block">
                        <span className="field-label">
                          {sessionForm.frequency === "once"
                            ? "Data da sessão"
                            : "Início"}
                        </span>
                        <input
                          className="field-control mt-2"
                          type="date"
                          value={sessionForm.startDate}
                          onChange={(event) =>
                            setSessionForm((current) => ({
                              ...current,
                              startDate: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        className="primary-button flex-1"
                        type="submit"
                        disabled={isSavingSession}
                      >
                        <Plus size={18} aria-hidden="true" />
                        {isSavingSession
                          ? "Salvando..."
                          : isEditing
                            ? "Salvar alterações"
                            : "Adicionar sessão"}
                      </button>
                      {isEditing ? (
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={resetSessionForm}
                        >
                          <X size={18} aria-hidden="true" />
                          Cancelar
                        </button>
                      ) : null}
                    </div>
                  </form>
                ) : null}
              </section>

              <section className="surface-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#24473f]">
                      Resumo do mês
                    </p>
                    <p className="mt-1 text-xs capitalize text-[#7b8d89]">
                      {getMonthLabel(selectedMonth)}
                    </p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff3e3] text-[#ac6d26]">
                    <WalletCards size={19} aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-5 space-y-3">
                  <SummaryRow label="Sessões" value={allOccurrences.length} />
                  <SummaryRow
                    label="Realizadas"
                    value={totals.completedSessions}
                    strong
                  />
                  <SummaryRow label="Faltas" value={totals.missedSessions} />
                  <SummaryRow
                    label="Canceladas"
                    value={totals.cancelledSessions}
                  />
                </div>
                <div className="mt-5 rounded-xl bg-[#eef6f3] px-4 py-3 text-xs leading-5 text-[#527069]">
                  Valores e status são atualizados automaticamente conforme
                  você registra os atendimentos.
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>

      <nav className="mobile-bottom-nav lg:hidden" aria-label="Navegação do aplicativo">
        <button
          className={viewMode === "day" ? "mobile-nav-active" : ""}
          type="button"
          onClick={() => setViewMode("day")}
        >
          <LayoutDashboard size={20} aria-hidden="true" />
          <span>Agenda</span>
        </button>
        <button
          className="mobile-add-button"
          type="button"
          onClick={openNewSessionForm}
        >
          <span>
            <Plus size={23} aria-hidden="true" />
          </span>
          <small>Novo</small>
        </button>
        <button
          className={viewMode === "month" ? "mobile-nav-active" : ""}
          type="button"
          onClick={() => setViewMode("month")}
        >
          <CalendarDays size={20} aria-hidden="true" />
          <span>Mês</span>
        </button>
      </nav>
    </main>
  );
}

function DayView({
  occurrences,
  selectedWeekday,
  sessions,
  showValues,
  onDeleteSession,
  onAddOneOffSession,
  onEditSession,
  onSetOccurrenceStatus,
}: {
  occurrences: SessionOccurrence[];
  selectedWeekday: WeekdayId;
  sessions: TherapySession[];
  showValues: boolean;
  onDeleteSession: (sessionId: string) => void;
  onAddOneOffSession: (session: TherapySession) => void;
  onEditSession: (session: TherapySession) => void;
  onSetOccurrenceStatus: (
    sessionId: string,
    dateKey: string,
    status: OccurrenceStatus,
  ) => void;
}) {
  const [expandedSessionIds, setExpandedSessionIds] = useState<
    Record<string, boolean>
  >({});

  function toggleExpanded(sessionId: string) {
    setExpandedSessionIds((currentExpanded) => ({
      ...currentExpanded,
      [sessionId]: !currentExpanded[sessionId],
    }));
  }

  return (
    <>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-[-0.02em] text-[#183a33]">
            Agenda de {getWeekdayLabel(selectedWeekday)}
          </h2>
          <p className="mt-1 text-sm text-[#71847f]">
            Abra um paciente para acompanhar os atendimentos.
          </p>
        </div>
        <span className="hidden rounded-full bg-[#e8f4f0] px-3 py-1.5 text-xs font-bold text-[#247866] sm:inline-flex">
          {sessions.length} {sessions.length === 1 ? "paciente" : "pacientes"}
        </span>
      </div>

      {sessions.length === 0 ? (
        <EmptyState text="Cadastre um atendimento recorrente ou uma sessão avulsa para começar." />
      ) : (
        <div className="grid gap-3">
          {sessions.map((session) => {
            const sessionOccurrences = occurrences.filter(
              (occurrence) => occurrence.session.id === session.id,
            );
            const completedCount = sessionOccurrences.filter(
              (occurrence) => occurrence.status === "completed",
            ).length;
            const missedCount = sessionOccurrences.filter(
              (occurrence) => occurrence.status === "missed",
            ).length;
            const cancelledCount = sessionOccurrences.filter(
              (occurrence) => occurrence.status === "cancelled",
            ).length;
            const isExpanded = Boolean(expandedSessionIds[session.id]);

            return (
              <article
                className="surface-card overflow-hidden transition hover:border-[#cbded8]"
                key={session.id}
              >
                <button
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-[#f8fbfa] sm:px-5 sm:py-5"
                  type="button"
                  onClick={() => toggleExpanded(session.id)}
                  aria-expanded={isExpanded}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e8f4f0] text-[#247866]">
                      <UserRound size={19} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-[#183a33]">
                        {session.patientName}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[#71847f]">
                        <span>{session.sessionTime}</span>
                        <span aria-hidden="true">•</span>
                        <span>{frequencyLabels[session.frequency]}</span>
                        <span aria-hidden="true">•</span>
                        <span>{completedCount}/{sessionOccurrences.length} feitas</span>
                        {missedCount ? <span>• {missedCount} faltas</span> : null}
                        {cancelledCount ? (
                          <span>• {cancelledCount} canceladas</span>
                        ) : null}
                      </span>
                    </span>
                  </span>
                  <ChevronDown
                    className={`shrink-0 text-[#71847f] transition ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    size={18}
                    aria-hidden="true"
                  />
                </button>

                {isExpanded ? (
                  <div className="border-t border-[#e5ece9] bg-[#fbfdfc] px-4 py-4 sm:px-5 sm:py-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#667a75]">
                          <span className="flex items-center gap-1">
                            <Clock size={15} aria-hidden="true" />
                            {session.sessionTime}
                          </span>
                          <span>
                            {session.frequency === "once"
                              ? `Avulsa em ${formatShortDate(session.startDate)}`
                              : `${frequencyLabels[session.frequency]} desde ${formatShortDate(session.startDate)}`}
                          </span>
                          <span>
                            {formatCurrency(session.sessionValue, showValues)}
                          </span>
                          <span>
                            {sessionOccurrences.length} ocorrência
                            {sessionOccurrences.length === 1 ? "" : "s"} no mês
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:flex">
                        <button
                          className="action-button"
                          type="button"
                          onClick={() => onAddOneOffSession(session)}
                        >
                          <Plus size={17} aria-hidden="true" />
                          Avulsa
                        </button>
                        <button
                          className="action-button"
                          type="button"
                          onClick={() => onEditSession(session)}
                        >
                          <Edit3 size={17} aria-hidden="true" />
                          Editar
                        </button>
                        <button
                          className="action-button border-[#f0d5c7] text-[#a24c2d] hover:bg-[#fff5ef]"
                          type="button"
                          onClick={() => onDeleteSession(session.id)}
                        >
                          <Trash2 size={17} aria-hidden="true" />
                          Excluir
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-2">
                      {sessionOccurrences.length ? (
                        sessionOccurrences.map((occurrence) => (
                          <OccurrenceRow
                            key={occurrence.id}
                            occurrence={occurrence}
                            showValues={showValues}
                            onSetOccurrenceStatus={onSetOccurrenceStatus}
                          />
                        ))
                      ) : (
                        <p className="rounded-xl bg-[#f1f6f4] px-4 py-3 text-sm text-[#71847f]">
                          Nenhuma data deste atendimento cai no mês selecionado.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

function MonthView({
  month,
  occurrences,
  showValues,
  onSetOccurrenceStatus,
}: {
  month: string;
  occurrences: SessionOccurrence[];
  showValues: boolean;
  onSetOccurrenceStatus: (
    sessionId: string,
    dateKey: string,
    status: OccurrenceStatus,
  ) => void;
}) {
  const occurrencesByDate = occurrences.reduce(
    (accumulator, occurrence) => {
      accumulator[occurrence.dateKey] = [
        ...(accumulator[occurrence.dateKey] ?? []),
        occurrence,
      ];
      return accumulator;
    },
    {} as Record<string, SessionOccurrence[]>,
  );

  return (
    <>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-[-0.02em] text-[#183a33]">
            Visão mensal
          </h2>
          <p className="mt-1 text-sm capitalize text-[#71847f]">
            {getMonthLabel(month)} · realizadas, faltas, canceladas e pendentes
          </p>
        </div>
        <span className="hidden rounded-full bg-[#e8f4f0] px-3 py-1.5 text-xs font-bold text-[#247866] sm:inline-flex">
          {occurrences.length} {occurrences.length === 1 ? "sessão" : "sessões"}
        </span>
      </div>

      {occurrences.length === 0 ? (
        <EmptyState text="Cadastre sessões recorrentes ou avulsas para montar a visão mensal." />
      ) : (
        <div className="grid gap-3">
          {Object.entries(occurrencesByDate).map(([dateKey, dateOccurrences]) => {
            const completedCount = dateOccurrences.filter(
              (occurrence) => occurrence.status === "completed",
            ).length;
            const missedCount = dateOccurrences.filter(
              (occurrence) => occurrence.status === "missed",
            ).length;
            const cancelledCount = dateOccurrences.filter(
              (occurrence) => occurrence.status === "cancelled",
            ).length;

            return (
              <section
                className="surface-card p-4 sm:p-5"
                key={dateKey}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f4f0] text-sm font-bold text-[#247866]">
                      {dateKey.split("-")[2]}
                    </span>
                    <div>
                      <h3 className="font-bold text-[#183a33]">
                        {getWeekdayLabel(getWeekdayFromDate(dateKey))}
                      </h3>
                      <p className="text-xs text-[#82928e]">{formatShortDate(dateKey)}</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-[#71847f] sm:text-sm">
                    {completedCount} feitas, {missedCount} faltas, {cancelledCount}{" "}
                    canceladas
                  </span>
                </div>
                <div className="grid gap-2">
                  {dateOccurrences.map((occurrence) => (
                    <OccurrenceRow
                      key={occurrence.id}
                      occurrence={occurrence}
                      showValues={showValues}
                      showPatientDetails
                      onSetOccurrenceStatus={onSetOccurrenceStatus}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function OccurrenceRow({
  occurrence,
  showValues,
  showPatientDetails = false,
  onSetOccurrenceStatus,
}: {
  occurrence: SessionOccurrence;
  showValues: boolean;
  showPatientDetails?: boolean;
  onSetOccurrenceStatus: (
    sessionId: string,
    dateKey: string,
    status: OccurrenceStatus,
  ) => void;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border px-3 py-3 transition sm:flex-row sm:items-center sm:justify-between sm:px-4 ${
        occurrence.status === "completed"
          ? "border-[#cae4dc] bg-[#f2faf7]"
          : occurrence.status === "missed"
            ? "occurrence-row-missed"
            : occurrence.status === "cancelled"
              ? "border-[#efd9cc] bg-[#fff8f4]"
              : "border-[#e3ebe8] bg-white"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            occurrence.status === "completed"
              ? "bg-[#2b8a78]"
              : occurrence.status === "missed"
                ? "occurrence-dot-missed"
                : occurrence.status === "cancelled"
                  ? "bg-[#d08355]"
                  : "bg-[#cad6d2]"
          }`}
        />
        <div className="min-w-0">
        <p className="truncate font-bold text-[#24443e]">
          {showPatientDetails
            ? occurrence.session.patientName
            : formatShortDate(occurrence.dateKey)}
        </p>
        <p className="mt-1 text-sm text-[#71847f]">
          {showPatientDetails
            ? `${getWeekdayLabel(occurrence.session.weekday)} às ${
                occurrence.session.sessionTime
              }`
            : `${occurrence.session.sessionTime}`}{" "}
          · {formatCurrency(occurrence.session.sessionValue, showValues)}
        </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:flex">
        <button
          className={`flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold transition ${
            occurrence.status === "completed"
              ? "border-[#2b8a78] bg-[#2b8a78] text-white"
              : "border-[#d8e3df] bg-white text-[#5c716c] hover:border-[#2b8a78] hover:text-[#247866]"
          }`}
          type="button"
          onClick={() =>
            onSetOccurrenceStatus(
              occurrence.session.id,
              occurrence.dateKey,
              "completed",
            )
          }
          aria-pressed={occurrence.status === "completed"}
        >
          {occurrence.status === "completed" ? (
            <CheckCircle2 size={18} aria-hidden="true" />
          ) : (
            <Check size={18} aria-hidden="true" />
          )}
          Fez
        </button>
        <button
          className={`flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold transition ${
            occurrence.status === "missed"
              ? "occurrence-missed-active"
              : "occurrence-missed-idle"
          }`}
          type="button"
          onClick={() =>
            onSetOccurrenceStatus(
              occurrence.session.id,
              occurrence.dateKey,
              "missed",
            )
          }
          aria-pressed={occurrence.status === "missed"}
        >
          <X size={18} aria-hidden="true" />
          Faltou
        </button>
        <button
          className={`flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold transition ${
            occurrence.status === "cancelled"
              ? "border-[#cf7c4b] bg-[#cf7c4b] text-white"
              : "border-[#d8e3df] bg-white text-[#5c716c] hover:border-[#cf7c4b] hover:text-[#a45229]"
          }`}
          type="button"
          onClick={() =>
            onSetOccurrenceStatus(
              occurrence.session.id,
              occurrence.dateKey,
              "cancelled",
            )
          }
          aria-pressed={occurrence.status === "cancelled"}
        >
          <Ban size={18} aria-hidden="true" />
          Cancelou
        </button>
      </div>
    </div>
  );
}

function TimeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { hour, minute } = getTimeParts(value);

  return (
    <label className="block">
      <span className="field-label">Horário</span>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <select
          className="field-control min-w-0 px-2"
          value={hour}
          onChange={(event) => onChange(`${event.target.value}:${minute}`)}
          aria-label="Hora"
        >
          {hourOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="text-sm font-bold text-[#71847f]">:</span>
        <select
          className="field-control min-w-0 px-2"
          value={minute}
          onChange={(event) => onChange(`${hour}:${event.target.value}`)}
          aria-label="Minuto"
        >
          {minuteOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="surface-card border-dashed px-6 py-12 text-center sm:py-16">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#edf6f3] text-[#2b806f]">
        <CalendarCheck size={28} aria-hidden="true" />
      </span>
      <h3 className="mt-5 text-lg font-bold text-[#183a33]">
        Nenhuma sessão por aqui
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#71847f]">
        {text}
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-[#71847f]">{label}</span>
      <span
        className={`text-sm ${
          strong ? "font-bold text-[#247866]" : "font-bold text-[#24443e]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function DashboardMetric({
  icon,
  label,
  value,
  detail,
  showValues,
  highlight = false,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  detail: string;
  showValues: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="metric-label">{label}</p>
          <p
            className={`mt-2 truncate text-xl font-bold tracking-[-0.02em] sm:text-2xl ${
              highlight ? "text-[#247866]" : "text-[#173a33]"
            }`}
          >
            {formatCurrency(value, showValues)}
          </p>
        </div>
        <span
          className={`metric-icon ${
            highlight
              ? "bg-[#e4f3ee] text-[#247866]"
              : "bg-[#f0f5f3] text-[#5d756f]"
          }`}
        >
          {icon}
        </span>
      </div>
      <p
        className={`mt-3 truncate text-xs ${highlight ? "text-[#538278]" : "text-[#899995]"}`}
      >
        {detail}
      </p>
    </div>
  );
}
