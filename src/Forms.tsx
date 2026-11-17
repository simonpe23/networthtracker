import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Check, CreditCard, Plus, Trash2, Wallet, X } from "lucide-react";
import type { Category, Holding, Portfolio } from "./model";

const maximumBalance = 1_000_000_000_000_000;
const colors = [
  "#087f5b",
  "#1f5c58",
  "#a36417",
  "#59743a",
  "#526b92",
  "#9a5273",
  "#7358a4",
  "#616b66",
];
const validBalance = (value: string) =>
  value.trim() !== "" &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0 &&
  Number(value) <= maximumBalance;

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const subtitleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(
    typeof document === "undefined"
      ? null
      : (document.activeElement as HTMLElement),
  );
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = previousFocusRef.current;
    const previousOverflow = document.body.style.overflow;
    const el = ref.current;
    const focusFirst = () => {
      const field =
        el?.querySelector<HTMLElement>("[autofocus]") ??
        el?.querySelector<HTMLElement>("input:not([type=hidden]), select") ??
        el?.querySelector<HTMLElement>("button");
      field?.focus();
    };
    focusFirst();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab" || !el) return;
      const controls = Array.from(
        el.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled):not([type=hidden]), select:not(:disabled), textarea, a[href], summary, [tabindex='0']",
        ),
      ).filter((node) => node.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!controls.length) {
        event.preventDefault();
        el.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !el.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !el.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeRef.current();
      }}
    >
      <section
        className={`modal${wide ? " wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        ref={ref}
        tabIndex={-1}
      >
        <header className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p id={subtitleId}>{subtitle}</p>}
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={24} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function HoldingModal({
  holding,
  categories,
  currency,
  onClose,
  onSave,
  onDelete,
  onManage,
}: {
  holding?: Holding;
  categories: Category[];
  currency: string;
  onClose: () => void;
  onSave: (holding: Holding, edit: boolean) => void;
  onDelete: (holding: Holding) => void;
  onManage: () => void;
}) {
  const uid = useId();
  const [name, setName] = useState(holding?.name ?? "");
  const [kind, setKind] = useState<"asset" | "debt">(holding?.kind ?? "asset");
  const [value, setValue] = useState(holding ? String(holding.value) : "");
  const [categoryId, setCategoryId] = useState(
    categories.some((category) => category.id === holding?.categoryId)
      ? holding!.categoryId
      : (categories[0]?.id ?? ""),
  );
  const [institution, setInstitution] = useState(holding?.institution ?? "");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give this holding a name.");
      return;
    }
    if (!validBalance(value)) {
      setError("Enter a valid balance of zero or more.");
      return;
    }
    if (
      kind === "asset" &&
      !categories.some((category) => category.id === categoryId)
    ) {
      setError("Choose an asset category before saving.");
      return;
    }
    onSave(
      {
        id: holding?.id ?? crypto.randomUUID(),
        name: name.trim(),
        kind,
        categoryId: kind === "asset" ? categoryId : "",
        institution: institution.trim(),
        value: Number(value),
        updatedAt: new Date().toISOString(),
      },
      Boolean(holding),
    );
  };
  return (
    <Modal
      title={
        deleting
          ? "Delete this holding?"
          : holding
            ? "Edit holding"
            : "Add holding"
      }
      subtitle={
        deleting
          ? "Past snapshots and asset history will be kept."
          : "Enter its current total value. You can update it any time."
      }
      onClose={onClose}
    >
      {deleting ? (
        <>
          <div className="modal-body delete-confirmation">
            <p>
              <strong>{holding?.name}</strong> will be removed from your current
              portfolio. Your saved snapshots will remain unchanged.
            </p>
          </div>
          <footer className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setDeleting(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button danger"
              onClick={() => holding && onDelete(holding)}
            >
              <Trash2 size={18} />
              Delete holding
            </button>
          </footer>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <div className="modal-body">
            <fieldset className="form-field type-field">
              <legend className="form-label">What are you adding?</legend>
              <div className="segmented-control">
                <button
                  type="button"
                  className={kind === "asset" ? "selected" : ""}
                  aria-pressed={kind === "asset"}
                  onClick={() => setKind("asset")}
                >
                  <Wallet size={20} />
                  Asset
                </button>
                <button
                  type="button"
                  className={kind === "debt" ? "selected" : ""}
                  aria-pressed={kind === "debt"}
                  onClick={() => setKind("debt")}
                >
                  <CreditCard size={20} />
                  Debt
                </button>
              </div>
              <p className="field-hint type-description">
                {kind === "asset"
                  ? "Money or investments you own."
                  : "An amount you owe, such as a loan or credit card balance."}
              </p>
            </fieldset>
            <div className="form-field">
              <label className="form-label" htmlFor={`${uid}-name`}>
                Holding name
              </label>
              <input
                id={`${uid}-name`}
                className="form-input"
                maxLength={80}
                placeholder={
                  kind === "asset"
                    ? "e.g. Savings account"
                    : "e.g. Student loan"
                }
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
                autoComplete="off"
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor={`${uid}-value`}>
                Current balance
              </label>
              <div className="amount-input">
                <span className="currency-prefix">{currency}</span>
                <input
                  id={`${uid}-value`}
                  className="form-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max={maximumBalance}
                  step="any"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder="0.00"
                  aria-describedby={`${uid}-value-hint`}
                  required
                />
              </div>
              <p className="field-hint" id={`${uid}-value-hint`}>
                {kind === "debt"
                  ? `Enter the positive amount you still owe, in ${currency}.`
                  : `Total value of this holding, in ${currency}. Not the price per unit.`}
              </p>
            </div>
            {kind === "asset" && (
              <div className="form-field">
                <label className="form-label" htmlFor={`${uid}-category`}>
                  Category
                </label>
                <select
                  id={`${uid}-category`}
                  className="form-input"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  required
                >
                  {!categories.length && (
                    <option value="">No categories yet</option>
                  )}
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <p className="field-hint">
                  Groups similar assets for your allocation targets.
                </p>
                {!categories.length && (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={onManage}
                  >
                    <Plus size={18} />
                    Create a category
                  </button>
                )}
              </div>
            )}
            <details
              className="optional-details"
              open={holding?.institution ? true : undefined}
            >
              <summary>Optional account details</summary>
              <div className="form-field">
                <label className="form-label" htmlFor={`${uid}-institution`}>
                  Institution or account
                </label>
                <input
                  id={`${uid}-institution`}
                  className="form-input"
                  maxLength={80}
                  placeholder="e.g. Vanguard, Chase, or personal"
                  value={institution}
                  onChange={(event) => setInstitution(event.target.value)}
                />
                <p className="field-hint">
                  A label to help you recognize this holding.
                </p>
              </div>
            </details>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <footer className="modal-actions">
            {holding && (
              <button
                type="button"
                className="button delete-link"
                aria-label="Delete holding"
                onClick={() => setDeleting(true)}
              >
                <Trash2 size={18} />
                Delete
              </button>
            )}
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="button primary">
              <Check size={18} />
              {holding ? "Save changes" : "Add holding"}
            </button>
          </footer>
        </form>
      )}
    </Modal>
  );
}

export function BalancesModal({
  portfolio,
  onClose,
  onSave,
}: {
  portfolio: Portfolio;
  onClose: () => void;
  onSave: (values: Record<string, number>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      portfolio.holdings.map((holding) => [holding.id, String(holding.value)]),
    ),
  );
  const [error, setError] = useState("");
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (Object.values(values).some((value) => !validBalance(value))) {
      setError("Each balance must be a valid number of zero or more.");
      return;
    }
    onSave(
      Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, Number(value)]),
      ),
    );
  };
  return (
    <Modal
      title="Update balances"
      subtitle={`Enter the latest total value for each holding in ${portfolio.currency}.`}
      onClose={onClose}
      wide
    >
      <form onSubmit={onSubmit} noValidate>
        <div className="modal-body">
          <div className="balance-editor-list">
            {portfolio.holdings.map((holding) => (
              <label className="balance-editor-row" key={holding.id}>
                <span className="balance-editor-name">
                  <strong>{holding.name}</strong>
                  <span>
                    {holding.kind === "debt"
                      ? "Debt · enter amount owed"
                      : (portfolio.categories.find(
                          (category) => category.id === holding.categoryId,
                        )?.name ?? "Asset")}
                  </span>
                </span>
                <div className="amount-input">
                  <span className="currency-prefix">{portfolio.currency}</span>
                  <input
                    className="form-input"
                    aria-label={`${holding.name} balance`}
                    type="number"
                    min="0"
                    max={maximumBalance}
                    step="any"
                    inputMode="decimal"
                    value={values[holding.id]}
                    onChange={(event) =>
                      setValues((previous) => ({
                        ...previous,
                        [holding.id]: event.target.value,
                      }))
                    }
                  />
                </div>
              </label>
            ))}
          </div>
          <p className="field-hint">
            Changes update today’s daily balance history. Use Take snapshot to
            save a separate point-in-time record.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button primary">
            <Check size={18} />
            Save balances
          </button>
        </footer>
      </form>
    </Modal>
  );
}

export function TargetsModal({
  portfolio,
  onClose,
  onSave,
}: {
  portfolio: Portfolio;
  onClose: () => void;
  onSave: (categories: Category[]) => void;
}) {
  const [categories, setCategories] = useState(() =>
    portfolio.categories.map((category) => ({ ...category })),
  );
  const [targetValues, setTargetValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      portfolio.categories.map((category) => [
        category.id,
        String(category.target),
      ]),
    ),
  );
  const [error, setError] = useState("");
  const total = categories.reduce(
    (sum, category) => sum + (Number(targetValues[category.id]) || 0),
    0,
  );
  const complete = Math.abs(total - 100) < 0.001;
  const patch = (categoryId: string, part: Partial<Category>) =>
    setCategories((previous) =>
      previous.map((category) =>
        category.id === categoryId ? { ...category, ...part } : category,
      ),
    );
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!categories.length) {
      setError("Add at least one category.");
      return;
    }
    if (categories.some((category) => !category.name.trim())) {
      setError("Give every category a name.");
      return;
    }
    if (
      new Set(categories.map((category) => category.name.trim().toLowerCase()))
        .size !== categories.length
    ) {
      setError("Each category needs a different name.");
      return;
    }
    if (
      categories.some((category) => {
        const value = targetValues[category.id];
        return (
          value.trim() === "" ||
          !Number.isFinite(Number(value)) ||
          Number(value) < 0 ||
          Number(value) > 100
        );
      }) ||
      !complete
    ) {
      setError(
        "Targets must add up to 100%. Use a percentage between 0 and 100 for each category.",
      );
      return;
    }
    onSave(
      categories.map((category) => ({
        ...category,
        name: category.name.trim(),
        target: Number(targetValues[category.id]),
      })),
    );
  };
  const addCategory = () => {
    const categoryId = crypto.randomUUID();
    setCategories((previous) => [
      ...previous,
      {
        id: categoryId,
        name: "",
        color: colors[previous.length % colors.length],
        target: 0,
      },
    ]);
    setTargetValues((previous) => ({ ...previous, [categoryId]: "0" }));
  };
  const removeCategory = (category: Category) => {
    if (
      portfolio.holdings.some(
        (holding) =>
          holding.kind === "asset" && holding.categoryId === category.id,
      )
    ) {
      setError(
        `Move or delete the assets in ${category.name || "this category"} before removing it.`,
      );
      return;
    }
    setCategories((previous) =>
      previous.filter((item) => item.id !== category.id),
    );
    setError("");
  };
  return (
    <Modal
      title="Categories & targets"
      subtitle="Group your assets and choose how much you want in each category."
      onClose={onClose}
      wide
    >
      <form onSubmit={onSubmit} noValidate>
        <div className="modal-body">
          <div className="targets-header">
            <span>Category</span>
            <span>Target %</span>
          </div>
          {categories.map((category, index) => (
            <div className="category-editor-row" key={category.id}>
              <input
                className="color-input"
                type="color"
                aria-label={`Color for ${category.name || "new category"}`}
                value={category.color}
                onChange={(event) =>
                  patch(category.id, { color: event.target.value })
                }
              />
              <input
                className="form-input category-name-input"
                aria-label={`Category ${index + 1} name`}
                placeholder="Category name"
                maxLength={35}
                value={category.name}
                onChange={(event) =>
                  patch(category.id, { name: event.target.value })
                }
              />
              <div className="target-input">
                <input
                  className="form-input"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  max="100"
                  aria-label={`Target for ${category.name || "new category"}`}
                  value={targetValues[category.id]}
                  onChange={(event) =>
                    setTargetValues((previous) => ({
                      ...previous,
                      [category.id]: event.target.value,
                    }))
                  }
                />
                <span>%</span>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove ${category.name || "new category"}`}
                onClick={() => removeCategory(category)}
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="button secondary add-category"
            onClick={addCategory}
          >
            <Plus size={18} />
            Add category
          </button>
          <div
            className={`target-total ${complete ? "complete" : total > 100 ? "over" : ""}`}
          >
            <span>Total target allocation</span>
            <strong>{Number(total.toFixed(2))}% / 100%</strong>
          </div>
          <p className="target-explanation field-hint">
            {complete
              ? "All assets are accounted for. Targets can be changed at any time."
              : total < 100
                ? `${Number((100 - total).toFixed(2))}% left to allocate. Your targets must total 100%.`
                : `Reduce your targets by ${Number((total - 100).toFixed(2))}% to reach 100%.`}
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button primary">
            <Check size={18} />
            Save targets
          </button>
        </footer>
      </form>
    </Modal>
  );
}
