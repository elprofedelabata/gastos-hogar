import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import type { MoneyShares } from "@/lib/domain";
import {
  getFirebaseClient,
  householdId,
  isFirebaseConfigured,
} from "@/lib/firebase/client";

export type Expense = {
  id: string;
  name: string;
  category: string;
  date: string;
  amountCents: number;
  payments: MoneyShares;
  allocations: MoneyShares;
  createdAtMillis: number;
};

export type ExpenseDraftRecord = Omit<Expense, "id" | "createdAtMillis">;

export type ExpenseStoreMode =
  | "local"
  | "connecting"
  | "auth-required"
  | "synced"
  | "error";

const LOCAL_STORAGE_KEY = "mi-casa-expenses-v1";

const demoExpenses: Expense[] = [
  {
    id: "demo-mercadona",
    name: "Mercadona",
    category: "Supermercado",
    date: "2026-08-22",
    amountCents: 6_235,
    payments: { dani: 6_235 },
    allocations: { dani: 3_118, ana: 3_117 },
    createdAtMillis: Date.parse("2026-08-22T09:30:00+02:00"),
  },
  {
    id: "demo-electricidad",
    name: "Electricidad",
    category: "Suministros",
    date: "2026-08-21",
    amountCents: 7_810,
    payments: { ana: 7_810 },
    allocations: { dani: 3_905, ana: 3_905 },
    createdAtMillis: Date.parse("2026-08-21T18:10:00+02:00"),
  },
  {
    id: "demo-internet",
    name: "Internet",
    category: "Suministros",
    date: "2026-08-18",
    amountCents: 3_990,
    payments: { dani: 3_990 },
    allocations: { dani: 1_995, ana: 1_995 },
    createdAtMillis: Date.parse("2026-08-18T12:00:00+02:00"),
  },
];

function loadLocalExpenses(): Expense[] {
  try {
    const serialized = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!serialized) return demoExpenses;
    const parsed = JSON.parse(serialized) as Expense[];
    return Array.isArray(parsed) ? parsed : demoExpenses;
  } catch {
    return demoExpenses;
  }
}

function saveLocalExpenses(expenses: Expense[]) {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(expenses));
  } catch {
    // The app remains usable in memory when browser storage is unavailable.
  }
}

function expenseFromDocument(snapshot: QueryDocumentSnapshot<DocumentData>): Expense {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    name: String(data.name ?? data.category ?? "Gasto"),
    category: String(data.category ?? "Otros"),
    date: String(data.date ?? ""),
    amountCents: Number(data.amountCents ?? 0),
    payments: (data.payments ?? {}) as MoneyShares,
    allocations: (data.allocations ?? {}) as MoneyShares,
    createdAtMillis:
      typeof data.createdAt?.toMillis === "function"
        ? data.createdAt.toMillis()
        : Number(data.createdAtMillis ?? 0),
  };
}

export function useExpenses() {
  const configured = isFirebaseConfigured();
  const [expenses, setExpenses] = useState<Expense[]>(() =>
    configured ? [] : loadLocalExpenses(),
  );
  const [mode, setMode] = useState<ExpenseStoreMode>(
    configured ? "connecting" : "local",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!configured) return;

    const client = getFirebaseClient();
    if (!client) return;

    let stopExpenses: Unsubscribe | undefined;
    const stopAuth = onAuthStateChanged(client.auth, (user) => {
      stopExpenses?.();
      stopExpenses = undefined;
      setError("");

      if (!user) {
        setExpenses([]);
        setMode("auth-required");
        return;
      }

      setMode("connecting");
      const expensesQuery = query(
        collection(client.database, "households", householdId, "expenses"),
        orderBy("createdAt", "desc"),
      );

      stopExpenses = onSnapshot(
        expensesQuery,
        (snapshot) => {
          setExpenses(snapshot.docs.map(expenseFromDocument));
          setMode("synced");
        },
        (firebaseError) => {
          setError(firebaseError.message);
          setMode("error");
        },
      );
    });

    return () => {
      stopExpenses?.();
      stopAuth();
    };
  }, [configured]);

  const addExpense = useCallback(
    async (draft: ExpenseDraftRecord) => {
      if (!configured) {
        const expense: Expense = {
          ...draft,
          id: `expense-${crypto.randomUUID()}`,
          createdAtMillis: Date.now(),
        };
        setExpenses((current) => {
          const next = [expense, ...current];
          saveLocalExpenses(next);
          return next;
        });
        return;
      }

      const client = getFirebaseClient();
      if (!client?.auth.currentUser) throw new Error("La sesión familiar ha caducado");

      await addDoc(
        collection(client.database, "households", householdId, "expenses"),
        {
          ...draft,
          createdAt: serverTimestamp(),
          createdBy: client.auth.currentUser.uid,
        },
      );
    },
    [configured],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const client = getFirebaseClient();
    if (!client) throw new Error("Firebase todavía no está configurado");
    setError("");
    setMode("connecting");
    try {
      await signInWithEmailAndPassword(client.auth, email, password);
    } catch (firebaseError) {
      setMode("auth-required");
      throw firebaseError;
    }
  }, []);

  const signOut = useCallback(async () => {
    const client = getFirebaseClient();
    if (client) await firebaseSignOut(client.auth);
  }, []);

  return {
    expenses,
    mode,
    error,
    isFirebaseConfigured: configured,
    addExpense,
    signIn,
    signOut,
  };
}
