import type { ValidationResult } from "../validate";

interface Props {
  result: ValidationResult;
}

export default function ValidationPanel({ result }: Props) {
  return (
    <div>
      <div className="panel-header">
        <h2>Проверка базы</h2>
      </div>

      <p className="muted">
        Перед сохранением на диск выполняются те же проверки, что и в <code>server/src/data/validate.ts</code>.
      </p>

      {result.ok ? (
        <div className="validation-ok">Ошибок не найдено — базу можно сохранять.</div>
      ) : (
        <div className="validation-error">
          <strong>Найдено ошибок: {result.errors.length}</strong>
          <ul className="validation-list">
            {result.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
