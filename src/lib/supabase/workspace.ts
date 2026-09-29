import type { User } from "@supabase/supabase-js";
import { supabase } from "./client";

export type WeekdayId =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type SessionFrequency = "weekly" | "biweekly" | "once";
export type OccurrenceStatus = "completed" | "missed" | "cancelled";

export type TherapySession = {
  id: string;
  patientId: string;
  weekday: WeekdayId;
  patientName: string;
  sessionTime: string;
  sessionValue: number;
  frequency: SessionFrequency;
  startDate: string;
  createdAt: string;
};

export type CompletionStore = Record<string, OccurrenceStatus>;

export type SessionInput = {
  patientId?: string | null;
  patientName: string;
  sessionTime: string;
  sessionValue: number;
  frequency: SessionFrequency;
  weekday: WeekdayId;
  startDate: string;
};

type PatientRow = {
  id: string;
  name: string;
};

type SessionRow = {
  id: string;
  patient_id: string;
  weekday: WeekdayId;
  session_time: string;
  session_value: number | string;
  frequency: SessionFrequency;
  start_date: string;
  created_at: string;
};

type OccurrenceRow = {
  therapy_session_id: string;
  occurrence_date: string;
  status: OccurrenceStatus;
};

function getCompletionKey(sessionId: string, dateKey: string) {
  return `${dateKey}:${sessionId}`;
}

function throwIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

export async function loadAuthenticatedWorkspace(user: User) {
  const [profileResult, patientsResult, sessionsResult, occurrencesResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("patients")
        .select("id, name")
        .eq("user_id", user.id),
      supabase
        .from("therapy_sessions")
        .select(
          "id, patient_id, weekday, session_time, session_value, frequency, start_date, created_at",
        )
        .eq("user_id", user.id),
      supabase
        .from("session_occurrences")
        .select("therapy_session_id, occurrence_date, status")
        .eq("user_id", user.id),
    ]);

  throwIfError(profileResult.error);
  throwIfError(patientsResult.error);
  throwIfError(sessionsResult.error);
  throwIfError(occurrencesResult.error);

  const fallbackName =
    typeof user.user_metadata.full_name === "string"
      ? user.user_metadata.full_name
      : user.email?.split("@")[0] ?? "Psicólogo";

  if (!profileResult.data) {
    const profileInsert = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fallbackName,
    });
    throwIfError(profileInsert.error);
  }

  const patients = (patientsResult.data ?? []) as PatientRow[];
  const patientNames = new Map(
    patients.map((patient) => [patient.id, patient.name]),
  );
  const sessions = ((sessionsResult.data ?? []) as SessionRow[]).map(
    (session) => ({
      id: session.id,
      patientId: session.patient_id,
      weekday: session.weekday,
      patientName: patientNames.get(session.patient_id) ?? "Paciente",
      sessionTime: session.session_time.slice(0, 5),
      sessionValue: Number(session.session_value),
      frequency: session.frequency,
      startDate: session.start_date,
      createdAt: session.created_at,
    }),
  );
  const completions = Object.fromEntries(
    ((occurrencesResult.data ?? []) as OccurrenceRow[]).map((occurrence) => [
      getCompletionKey(
        occurrence.therapy_session_id,
        occurrence.occurrence_date,
      ),
      occurrence.status,
    ]),
  ) as CompletionStore;

  return {
    accountName: profileResult.data?.full_name ?? fallbackName,
    sessions,
    completions,
  };
}

async function resolvePatientId(userId: string, input: SessionInput) {
  if (input.patientId) {
    const updateResult = await supabase
      .from("patients")
      .update({ name: input.patientName })
      .eq("id", input.patientId)
      .eq("user_id", userId);
    throwIfError(updateResult.error);
    return input.patientId;
  }

  const existingResult = await supabase
    .from("patients")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", input.patientName)
    .maybeSingle();
  throwIfError(existingResult.error);

  if (existingResult.data) {
    return existingResult.data.id as string;
  }

  const insertResult = await supabase
    .from("patients")
    .insert({ user_id: userId, name: input.patientName })
    .select("id")
    .single();
  throwIfError(insertResult.error);

  if (!insertResult.data) {
    throw new Error("Não foi possível criar o paciente.");
  }

  return insertResult.data.id as string;
}

export async function createTherapySession(
  userId: string,
  input: SessionInput,
) {
  const patientId = await resolvePatientId(userId, input);
  const result = await supabase
    .from("therapy_sessions")
    .insert({
      user_id: userId,
      patient_id: patientId,
      weekday: input.weekday,
      session_time: input.sessionTime,
      session_value: input.sessionValue,
      frequency: input.frequency,
      start_date: input.startDate,
    })
    .select(
      "id, patient_id, weekday, session_time, session_value, frequency, start_date, created_at",
    )
    .single();
  throwIfError(result.error);

  const session = result.data as SessionRow;

  return {
    id: session.id,
    patientId,
    weekday: session.weekday,
    patientName: input.patientName,
    sessionTime: session.session_time.slice(0, 5),
    sessionValue: Number(session.session_value),
    frequency: session.frequency,
    startDate: session.start_date,
    createdAt: session.created_at,
  } satisfies TherapySession;
}

export async function updateTherapySession(
  userId: string,
  sessionId: string,
  input: SessionInput,
) {
  const patientId = await resolvePatientId(userId, input);
  const result = await supabase
    .from("therapy_sessions")
    .update({
      patient_id: patientId,
      weekday: input.weekday,
      session_time: input.sessionTime,
      session_value: input.sessionValue,
      frequency: input.frequency,
      start_date: input.startDate,
    })
    .eq("id", sessionId)
    .eq("user_id", userId);
  throwIfError(result.error);
}

export async function removeTherapySession(
  userId: string,
  sessionId: string,
) {
  const result = await supabase
    .from("therapy_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId);
  throwIfError(result.error);
}

export async function persistOccurrenceStatus({
  userId,
  sessionId,
  dateKey,
  currentStatus,
  nextStatus,
}: {
  userId: string;
  sessionId: string;
  dateKey: string;
  currentStatus?: OccurrenceStatus;
  nextStatus: OccurrenceStatus;
}) {
  if (currentStatus === nextStatus) {
    const deleteResult = await supabase
      .from("session_occurrences")
      .delete()
      .eq("therapy_session_id", sessionId)
      .eq("occurrence_date", dateKey)
      .eq("user_id", userId);
    throwIfError(deleteResult.error);
    return undefined;
  }

  const upsertResult = await supabase.from("session_occurrences").upsert(
    {
      user_id: userId,
      therapy_session_id: sessionId,
      occurrence_date: dateKey,
      status: nextStatus,
    },
    { onConflict: "therapy_session_id,occurrence_date" },
  );
  throwIfError(upsertResult.error);
  return nextStatus;
}
