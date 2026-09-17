export const STORAGE_KEY = 'student-expenses:v1';
export const CURRENCY = 'KZT';

export interface Expense {
  id: string;
  amount: number;
  category: string;
  date: string;
  description: string;
}

export interface ExpenseInput {
  amount: string | number;
  category: string;
  date: string;
  description?: string;
}

export interface ValidatedExpenseInput {
  amount: number;
  category: string;
  date: string;
  description: string;
}

export type ExpenseField = 'amount' | 'category' | 'date';

export interface ValidationResult {
  isValid: boolean;
  errors: Partial<Record<ExpenseField, string>>;
  value: ValidatedExpenseInput;
}

export interface AppendExpenseResult {
  expenses: Expense[];
  expense: Expense | null;
  validation: ValidationResult;
}

export interface MonthlySummary {
  month: string;
  total: number;
  byCategory: Map<string, number>;
  expenseCount: number;
}

export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function isCalendarMonth(value: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function validateExpenseInput(input: ExpenseInput): ValidationResult {
  const errors: ValidationResult['errors'] = {};
  const amountText = String(input.amount ?? '').trim();
  const amount = Number(amountText);
  const category = String(input.category ?? '').trim();
  const date = String(input.date ?? '').trim();
  const description = String(input.description ?? '').trim();

  if (amountText === '') {
    errors.amount = 'Укажите сумму.';
  } else if (!Number.isFinite(amount)) {
    errors.amount = 'Введите сумму числом.';
  } else if (amount <= 0) {
    errors.amount = 'Сумма должна быть больше нуля.';
  }

  if (category === '') errors.category = 'Укажите категорию.';

  if (date === '') {
    errors.date = 'Укажите дату.';
  } else if (!isCalendarDate(date)) {
    errors.date = 'Введите корректную дату.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    value: { amount, category, date, description },
  };
}

export function createExpense(
  input: ExpenseInput,
  idFactory: () => string = () => crypto.randomUUID(),
): Expense {
  return {
    id: idFactory(),
    amount: Number(input.amount),
    category: input.category.trim(),
    date: input.date,
    description: (input.description ?? '').trim(),
  };
}

export function appendExpense(
  expenses: Expense[],
  input: ExpenseInput,
  idFactory: () => string = () => crypto.randomUUID(),
): AppendExpenseResult {
  const validation = validateExpenseInput(input);
  if (!validation.isValid) return { expenses, expense: null, validation };

  const expense = createExpense(validation.value, idFactory);
  return {
    expenses: [...expenses, expense],
    expense,
    validation,
  };
}

export function isExpense(value: unknown): value is Expense {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;

  return typeof candidate.id === 'string'
    && candidate.id.length > 0
    && typeof candidate.amount === 'number'
    && Number.isFinite(candidate.amount)
    && candidate.amount > 0
    && typeof candidate.category === 'string'
    && candidate.category.trim().length > 0
    && typeof candidate.date === 'string'
    && isCalendarDate(candidate.date)
    && typeof candidate.description === 'string';
}

export function loadExpenses(storage: Pick<Storage, 'getItem'>): Expense[] {
  try {
    const serialized = storage.getItem(STORAGE_KEY);
    if (serialized === null) return [];

    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed) || !parsed.every(isExpense)) return [];

    const ids = new Set(parsed.map((expense) => expense.id));
    return ids.size === parsed.length ? parsed : [];
  } catch {
    return [];
  }
}

export function saveExpenses(
  storage: Pick<Storage, 'setItem'>,
  expenses: Expense[],
): void {
  if (!expenses.every(isExpense)) {
    throw new TypeError('Нельзя сохранить некорректный список расходов');
  }

  const ids = new Set(expenses.map((expense) => expense.id));
  if (ids.size !== expenses.length) {
    throw new TypeError('Нельзя сохранить расходы с повторяющимися идентификаторами');
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

export function filterExpensesByMonth(expenses: Expense[], month: string): Expense[] {
  if (!isCalendarMonth(month)) return [];
  return expenses.filter((expense) => expense.date.startsWith(`${month}-`));
}

export function removeExpense(expenses: Expense[], expenseId: string): Expense[] {
  return expenses.filter((expense) => expense.id !== expenseId);
}

export function normalizeCategoryKey(category: string): string {
  return category.trim().toLocaleLowerCase('ru-RU');
}

export function calculateMonthlySummary(expenses: Expense[], month: string): MonthlySummary {
  const monthExpenses = filterExpensesByMonth(expenses, month);
  const byCategory = new Map<string, number>();
  const categoryLabels = new Map<string, string>();

  for (const expense of monthExpenses) {
    const categoryKey = normalizeCategoryKey(expense.category);
    const categoryLabel = categoryLabels.get(categoryKey) ?? expense.category;
    categoryLabels.set(categoryKey, categoryLabel);

    const categoryTotal = byCategory.get(categoryLabel) ?? 0;
    byCategory.set(categoryLabel, categoryTotal + expense.amount);
  }

  const total = [...byCategory.values()].reduce((sum, amount) => sum + amount, 0);

  return {
    month,
    total,
    byCategory,
    expenseCount: monthExpenses.length,
  };
}
