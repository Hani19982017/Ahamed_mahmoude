import { CalendarIcon } from "lucide-react";
import { useDialogComposition } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useComposition } from "@/hooks/useComposition";
import { DATE_INPUT_LOCALE, getDateInputProps, isGermanDateInput } from "@/lib/uiFormatting";
import { cn } from "@/lib/utils";
import * as React from "react";

function formatGermanDateDisplay(value: React.ComponentProps<"input">["value"], type?: string) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  const raw = String(value);

  if (type !== "date") {
    return raw;
  }

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}.${month}.${year}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString(DATE_INPUT_LOCALE);
  }

  return raw;
}

function getGermanDatePlaceholder(type?: string) {
  if (type === "date") {
    return "TT.MM.JJJJ";
  }

  if (type === "datetime-local") {
    return undefined;
  }

  return undefined;
}

function parseIsoDate(value: React.ComponentProps<"input">["value"]) {
  if (typeof value !== "string") {
    return undefined;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return undefined;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return undefined;
  }

  return parsed;
}

function toIsoDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function Input({
  className,
  type,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  onFocus,
  onBlur,
  onChange,
  lang,
  dir,
  value,
  placeholder,
  disabled,
  readOnly,
  name,
  id,
  required,
  autoFocus,
  ...props
}: React.ComponentProps<"input">) {
  const dialogComposition = useDialogComposition();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isDateLikeInput = isGermanDateInput(type);
  const isCalendarDateInput = type === "date";
  const [calendarOpen, setCalendarOpen] = React.useState(false);

  const {
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
    onKeyDown: handleKeyDown,
  } = useComposition<HTMLInputElement>({
    onKeyDown: (e) => {
      const isComposing = (e.nativeEvent as { isComposing?: boolean }).isComposing || dialogComposition.justEndedComposing();

      if (e.key === "Enter" && isComposing) {
        return;
      }

      onKeyDown?.(e);
    },
    onCompositionStart: (e) => {
      dialogComposition.setComposing(true);
      onCompositionStart?.(e);
    },
    onCompositionEnd: (e) => {
      dialogComposition.markCompositionEnd();
      window.setTimeout(() => {
        dialogComposition.setComposing(false);
      }, 100);
      onCompositionEnd?.(e);
    },
  });

  const dateInputProps = getDateInputProps(type);

  const emitInputChange = React.useCallback(
    (nextValue: string) => {
      if (!onChange) {
        return;
      }

      onChange({
        target: { value: nextValue },
        currentTarget: { value: nextValue },
      } as React.ChangeEvent<HTMLInputElement>);
    },
    [onChange],
  );

  const selectedDate = React.useMemo(() => parseIsoDate(value), [value]);
  const renderedValue = formatGermanDateDisplay(value, type);
  const renderedPlaceholder = isDateLikeInput ? getGermanDatePlaceholder(type) : placeholder;

  if (isCalendarDateInput) {
    const openCalendar = () => {
      if (!disabled && !readOnly) {
        setCalendarOpen(true);
      }
    };

    const closeCalendar = () => {
      setCalendarOpen(false);
    };

    const handleSelectDate = (date?: Date) => {
      emitInputChange(date ? toIsoDateValue(date) : "");
      closeCalendar();
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    };

    return (
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <input
              ref={inputRef}
              id={id}
              type="text"
              value={renderedValue}
              placeholder={renderedPlaceholder}
              data-slot="input"
              className={cn(
                "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 pr-10 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
                !renderedValue && "text-muted-foreground",
                !disabled && !readOnly && "cursor-pointer",
                className,
              )}
              onClick={openCalendar}
              onFocus={(e) => {
                openCalendar();
                onFocus?.(e);
              }}
              onBlur={onBlur}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !disabled && !readOnly) {
                  e.preventDefault();
                  openCalendar();
                  return;
                }

                if ((e.key === "Backspace" || e.key === "Delete") && !disabled && !readOnly) {
                  e.preventDefault();
                  emitInputChange("");
                  return;
                }

                handleKeyDown(e);
              }}
              lang={lang ?? dateInputProps.lang}
              dir={dir ?? dateInputProps.dir}
              disabled={disabled}
              readOnly
              required={required}
              autoFocus={autoFocus}
              aria-haspopup="dialog"
              aria-expanded={calendarOpen}
              {...props}
            />
            {name ? <input type="hidden" name={name} value={typeof value === "string" ? value : ""} /> : null}
            <button
              type="button"
              className="absolute inset-y-0 left-3 flex items-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none"
              onClick={openCalendar}
              disabled={disabled || readOnly}
              aria-label="Datum auswählen"
              tabIndex={-1}
            >
              <CalendarIcon className="size-4" />
            </button>
          </div>
        </PopoverAnchor>
        {!disabled && !readOnly ? (
          <PopoverContent className="w-auto p-0" align="start" sideOffset={6} dir="ltr">
            <Calendar
              mode="single"
              selected={selectedDate}
              defaultMonth={selectedDate ?? new Date()}
              onSelect={handleSelectDate}
              initialFocus
            />
            <div className="flex items-center justify-between border-t px-3 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => handleSelectDate(new Date())}
              >
                Heute
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => handleSelectDate(undefined)}
              >
                Löschen
              </Button>
            </div>
          </PopoverContent>
        ) : null}
      </Popover>
    );
  }

  return (
    <input
      ref={inputRef}
      type={type}
      value={renderedValue}
      placeholder={renderedPlaceholder}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        isDateLikeInput && "cursor-pointer",
        className,
      )}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onKeyDown={handleKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      lang={lang ?? dateInputProps.lang}
      dir={dir ?? dateInputProps.dir}
      disabled={disabled}
      readOnly={readOnly}
      name={name}
      id={id}
      required={required}
      autoFocus={autoFocus}
      onChange={onChange}
      {...props}
    />
  );
}

export { Input };
