import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';

import {
  CURRENCY,
  appendExpense,
  calculateMonthlySummary,
  filterExpensesByMonth,
  loadExpenses,
  removeExpense,
  saveExpenses,
  type ExpenseField,
  type ExpenseInput,
} from './expense-core';

const currencyFormatter = new Intl.NumberFormat('ru-KZ', {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

interface FormState extends Required<ExpenseInput> {
  amount: string;
}

function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initialFormState(): FormState {
  return {
    amount: '',
    category: '',
    date: localDateString(),
    description: '',
  };
}

function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}

export function App() {
  const [expenses, setExpenses] = useState(() => loadExpenses(localStorage));
  const [selectedMonth, setSelectedMonth] = useState(() => localDateString().slice(0, 7));
  const [formValues, setFormValues] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<Partial<Record<ExpenseField, string>>>({});
  const [formStatus, setFormStatus] = useState('');
  const [statusIsError, setStatusIsError] = useState(false);
  const monthExpenses = useMemo(
    () => filterExpensesByMonth(expenses, selectedMonth)
      .toSorted((left, right) => right.date.localeCompare(left.date)),
    [expenses, selectedMonth],
  );
  const summary = useMemo(
    () => calculateMonthlySummary(expenses, selectedMonth),
    [expenses, selectedMonth],
  );
  const categoryTotals = useMemo(
    () => [...summary.byCategory.entries()].toSorted(([left], [right]) => left.localeCompare(right, 'ru')),
    [summary],
  );

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    const field = event.target.name as keyof FormState;
    setFormValues((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormStatus('');
    setStatusIsError(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const result = appendExpense(expenses, formValues);
    setErrors(result.validation.errors);

    if (!result.validation.isValid) {
      setFormStatus('Проверьте обязательные поля.');
      setStatusIsError(true);
      return;
    }

    try {
      saveExpenses(localStorage, result.expenses);
      setExpenses(result.expenses);
    } catch {
      setFormStatus('Не удалось сохранить расход в браузере.');
      setStatusIsError(true);
      return;
    }

    setFormValues((current) => ({ ...initialFormState(), date: current.date }));
    setFormStatus('Расход добавлен и сохранён.');
    setStatusIsError(false);
  }

  function handleDelete(expenseId: string): void {
    const nextExpenses = removeExpense(expenses, expenseId);

    try {
      saveExpenses(localStorage, nextExpenses);
      setExpenses(nextExpenses);
      setFormStatus('Расход удалён.');
      setStatusIsError(false);
    } catch {
      setFormStatus('Не удалось удалить расход из хранилища.');
      setStatusIsError(true);
    }
  }

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Личный бюджет</p>
          <h1>Мои расходы</h1>
          <p className="subtitle">
            Записывайте траты и сразу замечайте, куда уходит больше всего.
          </p>
        </div>
        <div className="currency-badge" aria-label="Валюта приложения — казахстанский тенге">
          <span>Валюта</span>
          <strong>₸ KZT</strong>
        </div>
      </header>

      <main className="workspace">
        <section className="card entry-card" aria-labelledby="entry-title">
          <div className="section-heading">
            <p className="step">Новая запись</p>
            <h2 id="entry-title">Добавить расход</h2>
          </div>

          <form id="expense-form" noValidate onSubmit={handleSubmit}>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="amount">
                  Сумма <span aria-hidden="true">*</span>
                </label>
                <div className="amount-control">
                  <input
                    id="amount"
                    name="amount"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    placeholder="0"
                    aria-describedby="amount-hint amount-error"
                    aria-invalid={Boolean(errors.amount)}
                    value={formValues.amount}
                    onChange={handleInputChange}
                    required
                  />
                  <span aria-hidden="true">₸</span>
                </div>
                <p id="amount-hint" className="hint">Только положительное число</p>
                <p id="amount-error" className="field-error">{errors.amount}</p>
              </div>

              <div className="field">
                <label htmlFor="category">
                  Категория <span aria-hidden="true">*</span>
                </label>
                <input
                  id="category"
                  name="category"
                  type="text"
                  autoComplete="off"
                  placeholder="Например, Еда"
                  aria-describedby="category-error"
                  aria-invalid={Boolean(errors.category)}
                  value={formValues.category}
                  onChange={handleInputChange}
                  required
                />
                <p id="category-error" className="field-error">{errors.category}</p>
              </div>

              <div className="field">
                <label htmlFor="date">
                  Дата <span aria-hidden="true">*</span>
                </label>
                <input
                  id="date"
                  name="date"
                  type="date"
                  aria-describedby="date-error"
                  aria-invalid={Boolean(errors.date)}
                  value={formValues.date}
                  onChange={handleInputChange}
                  required
                />
                <p id="date-error" className="field-error">{errors.date}</p>
              </div>

              <div className="field">
                <label htmlFor="description">
                  Описание <span className="optional">необязательно</span>
                </label>
                <input
                  id="description"
                  name="description"
                  type="text"
                  placeholder="Например, обед в столовой"
                  value={formValues.description}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div
              className={`form-status${statusIsError ? ' is-error' : ''}`}
              role="status"
              aria-live="polite"
            >
              {formStatus}
            </div>
            <button className="primary-button" type="submit">
              <span aria-hidden="true">＋</span>
              Добавить расход
            </button>
          </form>
        </section>

        <section className="card ledger-card" aria-labelledby="ledger-title">
          <div className="ledger-header">
            <div className="section-heading">
              <p className="step">Обзор месяца</p>
              <h2 id="ledger-title">Расходы и итоги</h2>
            </div>
            <div className="month-control">
              <label htmlFor="selected-month">Выбранный месяц</label>
              <input
                id="selected-month"
                type="month"
                required
                value={selectedMonth}
                onChange={(event) => {
                  if (event.target.value) setSelectedMonth(event.target.value);
                }}
              />
            </div>
          </div>
          <div id="ledger-content" aria-live="polite">
            <div className="summary-grid">
              <article className="total-card">
                <span>Всего за месяц</span>
                <strong data-testid="monthly-total">{currencyFormatter.format(summary.total)}</strong>
                <small>{summary.expenseCount} записей</small>
              </article>
              <section className="category-summary" aria-labelledby="categories-title">
                <div className="subheading-row">
                  <h3 id="categories-title">По категориям</h3>
                </div>
                <ul className="category-list">
                  {categoryTotals.map(([category, total]) => (
                    <li key={category}>
                      <span>{category}</span>
                      <strong>{currencyFormatter.format(total)}</strong>
                    </li>
                  ))}
                </ul>
                {categoryTotals.length === 0 && (
                  <p className="category-empty">Категорий пока нет</p>
                )}
              </section>
            </div>
            <section className="expenses-section" aria-labelledby="expenses-title">
              <div className="subheading-row">
                <h3 id="expenses-title">Записи</h3>
                <span className="count-badge">{monthExpenses.length}</span>
              </div>
              <ul className="expense-list">
                {monthExpenses.map((expense) => (
                  <li className="expense-item" key={expense.id} data-expense-id={expense.id}>
                    <div className="expense-main">
                      <span className="expense-category">{expense.category}</span>
                      <div className="expense-meta">
                        <time dateTime={expense.date}>{formatDate(expense.date)}</time>
                        {expense.description && (
                          <span className="expense-description">{expense.description}</span>
                        )}
                      </div>
                    </div>
                    <strong className="expense-amount">
                      {currencyFormatter.format(expense.amount)}
                    </strong>
                    <button
                      className="delete-button"
                      type="button"
                      aria-label={`Удалить расход: ${expense.category}, ${currencyFormatter.format(expense.amount)}`}
                      onClick={() => handleDelete(expense.id)}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </li>
                ))}
              </ul>
              {monthExpenses.length === 0 && (
                <div className="empty-state">
                  <span aria-hidden="true">₸</span>
                  <strong>В этом месяце расходов нет</strong>
                  <p>Добавьте первую запись через форму выше.</p>
                </div>
              )}
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
