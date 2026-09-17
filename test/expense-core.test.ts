import { describe, expect, it } from 'vitest';

import {
  STORAGE_KEY,
  appendExpense,
  calculateMonthlySummary,
  createExpense,
  filterExpensesByMonth,
  isExpense,
  loadExpenses,
  removeExpense,
  saveExpenses,
  validateExpenseInput,
} from '../src/expense-core';

describe('модель Expense', () => {
  it('создаёт полную модель и уникальные идентификаторы', () => {
    const ids = ['expense-1', 'expense-2'];
    const input = {
      amount: '1500',
      category: '  Еда  ',
      date: '2026-09-17',
      description: '',
    };

    const first = createExpense(input, () => ids.shift()!);
    const second = createExpense(input, () => ids.shift()!);

    expect(first).toEqual({
      id: 'expense-1',
      amount: 1500,
      category: 'Еда',
      date: '2026-09-17',
      description: '',
    });
    expect(isExpense(first)).toBe(true);
    expect(first.id).not.toBe(second.id);
  });
});

describe('loadExpenses', () => {
  it('безопасно обрабатывает отсутствующие, корректные и повреждённые данные', () => {
    const storage = new Map<string, string>();
    const storageAdapter = { getItem: (key: string) => storage.get(key) ?? null };
    const validExpenses = [{
      id: 'expense-1',
      amount: 1500,
      category: 'Еда',
      date: '2026-09-17',
      description: '',
    }];

    expect(loadExpenses(storageAdapter)).toEqual([]);

    storage.set(STORAGE_KEY, JSON.stringify(validExpenses));
    expect(loadExpenses(storageAdapter)).toEqual(validExpenses);

    storage.set(STORAGE_KEY, '{invalid-json');
    expect(loadExpenses(storageAdapter)).toEqual([]);

    storage.set(STORAGE_KEY, JSON.stringify([{ ...validExpenses[0], amount: -1 }]));
    expect(loadExpenses(storageAdapter)).toEqual([]);

    expect(loadExpenses({ getItem: () => { throw new Error('storage blocked'); } })).toEqual([]);
  });
});

describe('saveExpenses', () => {
  it('сохраняет только массив расходов без вычисляемых итогов', () => {
    const storage = new Map<string, string>();
    const expenses = [{
      id: 'expense-1',
      amount: 600,
      category: 'Транспорт',
      date: '2026-09-18',
      description: 'Автобус',
    }];

    saveExpenses({ setItem: (key, value) => storage.set(key, value) }, expenses);

    expect(JSON.parse(storage.get(STORAGE_KEY)!)).toEqual(expenses);
    expect(storage.get(STORAGE_KEY)).not.toContain('total');
  });
});

describe('filterExpensesByMonth', () => {
  it('возвращает все и только расходы выбранного месяца', () => {
    const expenses = [
      { id: '1', amount: 1500, category: 'Еда', date: '2026-09-01', description: '' },
      { id: '2', amount: 600, category: 'Транспорт', date: '2026-09-30', description: '' },
      { id: '3', amount: 900, category: 'Еда', date: '2026-10-01', description: '' },
    ];

    expect(filterExpensesByMonth(expenses, '2026-09').map(({ id }) => id)).toEqual(['1', '2']);
    expect(filterExpensesByMonth(expenses, '2026-10').map(({ id }) => id)).toEqual(['3']);
    expect(filterExpensesByMonth(expenses, '2026-11')).toEqual([]);
    expect(expenses).toHaveLength(3);
  });
});

describe('calculateMonthlySummary', () => {
  it('точно считает официальный пример и пустой месяц', () => {
    const expenses = [
      { id: '1', amount: 1500, category: 'Еда', date: '2026-09-01', description: '' },
      { id: '2', amount: 600, category: 'Транспорт', date: '2026-09-02', description: '' },
      { id: '3', amount: 900, category: 'Еда', date: '2026-09-03', description: '' },
    ];

    const summary = calculateMonthlySummary(expenses, '2026-09');
    expect(summary.total).toBe(3000);
    expect(summary.byCategory.get('Еда')).toBe(2400);
    expect(summary.byCategory.get('Транспорт')).toBe(600);
    expect([...summary.byCategory.values()].reduce((sum, value) => sum + value, 0)).toBe(summary.total);
    expect(summary.expenseCount).toBe(3);

    const emptySummary = calculateMonthlySummary(expenses, '2026-10');
    expect(emptySummary.total).toBe(0);
    expect(emptySummary.byCategory.size).toBe(0);
    expect(emptySummary.expenseCount).toBe(0);
  });

  it('объединяет категории без учёта регистра', () => {
    const expenses = [
      { id: '1', amount: 1500, category: 'Еда', date: '2026-09-01', description: '' },
      { id: '2', amount: 900, category: 'еда', date: '2026-09-02', description: '' },
      { id: '3', amount: 100, category: 'ЕДА', date: '2026-09-03', description: '' },
    ];

    const summary = calculateMonthlySummary(expenses, '2026-09');
    expect(summary.byCategory.size).toBe(1);
    expect(summary.byCategory.get('Еда')).toBe(2500);
    expect(summary.total).toBe(2500);
    expect([...summary.byCategory.values()].reduce((sum, value) => sum + value, 0)).toBe(summary.total);
    expect(expenses.map(({ category }) => category)).toEqual(['Еда', 'еда', 'ЕДА']);
  });
});

describe('validateExpenseInput', () => {
  it('отклоняет каждый неверный обязательный ввод', () => {
    const base = { amount: '1500', category: 'Еда', date: '2026-09-17', description: '' };

    expect(validateExpenseInput({ ...base, amount: '' }).errors.amount).toBe('Укажите сумму.');
    expect(validateExpenseInput({ ...base, amount: 'не число' }).errors.amount).toBe('Введите сумму числом.');
    expect(validateExpenseInput({ ...base, amount: '0' }).isValid).toBe(false);
    expect(validateExpenseInput({ ...base, amount: '-1' }).isValid).toBe(false);
    expect(validateExpenseInput({ ...base, category: '   ' }).errors.category).toBe('Укажите категорию.');
    expect(validateExpenseInput({ ...base, date: '' }).errors.date).toBe('Укажите дату.');
    expect(validateExpenseInput({ ...base, date: '2026-02-30' }).errors.date).toBe('Введите корректную дату.');

    const valid = validateExpenseInput(base);
    expect(valid.isValid).toBe(true);
    expect(valid.errors).toEqual({});
  });
});

describe('appendExpense', () => {
  it('добавляет ровно одну корректную запись и не добавляет неверную', () => {
    const input = { amount: '1500', category: 'Еда', date: '2026-09-17', description: '' };
    const added = appendExpense([], input, () => 'expense-1');
    const storage = new Map<string, string>();
    saveExpenses({ setItem: (key, value) => storage.set(key, value) }, added.expenses);

    expect(added.expenses).toHaveLength(1);
    expect(added.expense?.id).toBe('expense-1');
    expect(JSON.parse(storage.get(STORAGE_KEY)!)).toEqual(added.expenses);

    const rejected = appendExpense(added.expenses, { ...input, amount: '0' }, () => 'expense-2');
    expect(rejected.expenses).toBe(added.expenses);
    expect(rejected.expenses).toHaveLength(1);
    expect(rejected.expense).toBeNull();
  });
});

describe('removeExpense', () => {
  it('удаляет ровно выбранную запись по идентификатору', () => {
    const expenses = [
      { id: '1', amount: 900, category: 'Еда', date: '2026-09-01', description: '' },
      { id: '2', amount: 900, category: 'Еда', date: '2026-09-01', description: '' },
    ];

    const remaining = removeExpense(expenses, '2');
    expect(remaining.map(({ id }) => id)).toEqual(['1']);
  });
});

describe('согласованные переходы состояния', () => {
  it('пересчитывает итог после добавления, смены месяца и удаления', () => {
    const input = { amount: '1500', category: 'Еда', date: '2026-09-17', description: '' };
    let expenses = appendExpense([], input, () => 'expense-1').expenses;

    expect(calculateMonthlySummary(expenses, '2026-09').total).toBe(1500);
    expect(calculateMonthlySummary(expenses, '2026-10').total).toBe(0);
    expect(calculateMonthlySummary(expenses, '2026-09').byCategory.get('Еда')).toBe(1500);

    expenses = removeExpense(expenses, 'expense-1');
    const afterDelete = calculateMonthlySummary(expenses, '2026-09');
    expect(afterDelete.total).toBe(0);
    expect(afterDelete.byCategory.size).toBe(0);
    expect(afterDelete.expenseCount).toBe(0);
  });
});

describe('сохранение между загрузками приложения', () => {
  it('восстанавливает добавленные и не восстанавливает удалённые расходы', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    const inputs = [
      { amount: '1500', category: 'Еда', date: '2026-09-01', description: '' },
      { amount: '600', category: 'Транспорт', date: '2026-09-02', description: '' },
      { amount: '900', category: 'Еда', date: '2026-09-03', description: '' },
    ];
    let expenses = inputs.reduce(
      (current, input, index) => appendExpense(current, input, () => `expense-${index + 1}`).expenses,
      [] as ReturnType<typeof loadExpenses>,
    );

    saveExpenses(storage, expenses);
    expenses = loadExpenses(storage);
    expect(expenses).toHaveLength(3);
    expect(calculateMonthlySummary(expenses, '2026-09').total).toBe(3000);

    expenses = removeExpense(expenses, 'expense-3');
    saveExpenses(storage, expenses);
    const afterSecondLoad = loadExpenses(storage);
    expect(afterSecondLoad).toHaveLength(2);
    expect(calculateMonthlySummary(afterSecondLoad, '2026-09').total).toBe(2100);
    expect(calculateMonthlySummary(afterSecondLoad, '2026-09').byCategory.get('Еда')).toBe(1500);
  });
});

describe('официальный проверочный сценарий', () => {
  it('проходит добавление, расчёт, перезагрузку, удаление и смену месяца', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    const records = [
      { id: 'food-1500', amount: '1500', category: 'Еда', date: '2026-09-05', description: '' },
      { id: 'transport-600', amount: '600', category: 'Транспорт', date: '2026-09-06', description: '' },
      { id: 'food-900', amount: '900', category: 'Еда', date: '2026-09-07', description: '' },
    ];

    let expenses = records.reduce(
      (current, { id, ...input }) => appendExpense(current, input, () => id).expenses,
      [] as ReturnType<typeof loadExpenses>,
    );
    saveExpenses(storage, expenses);

    expenses = loadExpenses(storage);
    const beforeDelete = calculateMonthlySummary(expenses, '2026-09');
    expect(filterExpensesByMonth(expenses, '2026-09')).toHaveLength(3);
    expect(beforeDelete.total).toBe(3000);
    expect(beforeDelete.byCategory.get('Еда')).toBe(2400);
    expect(beforeDelete.byCategory.get('Транспорт')).toBe(600);
    expect([...beforeDelete.byCategory.values()].reduce((sum, value) => sum + value, 0)).toBe(beforeDelete.total);

    expenses = removeExpense(expenses, 'food-900');
    saveExpenses(storage, expenses);
    expenses = loadExpenses(storage);
    const afterDelete = calculateMonthlySummary(expenses, '2026-09');
    expect(filterExpensesByMonth(expenses, '2026-09')).toHaveLength(2);
    expect(afterDelete.total).toBe(2100);
    expect(afterDelete.byCategory.get('Еда')).toBe(1500);
    expect(afterDelete.byCategory.get('Транспорт')).toBe(600);
    expect([...afterDelete.byCategory.values()].reduce((sum, value) => sum + value, 0)).toBe(afterDelete.total);

    const emptyMonth = calculateMonthlySummary(expenses, '2026-10');
    expect(emptyMonth.total).toBe(0);
    expect(emptyMonth.expenseCount).toBe(0);
    expect(calculateMonthlySummary(expenses, '2026-09').total).toBe(2100);
  });
});
