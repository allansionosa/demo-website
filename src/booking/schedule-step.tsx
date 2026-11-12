import { useState } from "react"
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
} from "lucide-react"

import { Button } from "./button"
import { cn } from "./lib/utils"
import {
  addDays,
  clinicBranches,
  clinicHours,
  formatAppointmentDate,
  getClinicNow,
  getDateHours,
  getNextClinicDate,
  getScheduleError,
  parseDate,
} from "./lib/scheduling"

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function moveMonth(month: string, offset: number) {
  const date = parseDate(`${month}-01`)!
  date.setUTCMonth(date.getUTCMonth() + offset)
  return date.toISOString().slice(0, 7)
}

export function ScheduleStep({
  date,
  branch,
  now,
  onDateChange,
  onBranchChange,
}: {
  date: string
  branch: string
  now: Date
  onDateChange: (value: string) => void
  onBranchChange: (value: string) => void
}) {
  const nextDate = getNextClinicDate(now)
  const today = getClinicNow(now).date
  const [month, setMonth] = useState((date || nextDate).slice(0, 7))
  const firstDay = parseDate(`${month}-01`)!
  const nextMonth = moveMonth(month, 1)
  const daysInMonth = parseDate(addDays(`${nextMonth}-01`, -1))!.getUTCDate()
  const cellCount = Math.ceil((firstDay.getUTCDay() + daysInMonth) / 7) * 7
  const monthLabel = new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(firstDay)
  const dateError = date ? getScheduleError(date, now) : ""

  function chooseDate(value: string) {
    onDateChange(value)
    if (parseDate(value)) setMonth(value.slice(0, 7))
  }

  return (
    <div className="b:grid b:gap-5">
      <div>
        <h3 className="b:text-base b:font-semibold b:text-slate-950">
          Choose your visit date
        </h3>
        <p className="b:mt-1 b:text-sm b:leading-6 b:text-slate-600">
          Select a clinic and a date, then visit during that day's clinic hours.
          All dates and hours are in Philippine time (PHT).
        </p>
      </div>

      <label className="b:grid b:gap-2 b:text-sm b:font-medium b:text-slate-700">
        <span className="b:inline-flex b:items-center b:gap-2">
          <MapPin className="b:size-4 b:text-primary" aria-hidden="true" />
          Clinic branch <span className="b:text-red-600">*</span>
        </span>
        <span className="b:relative b:block">
          <select
            className="b:h-11 b:w-full b:appearance-none b:rounded-[8px] b:border b:border-border b:bg-background b:pr-10 b:pl-3 b:text-sm b:outline-none b:focus:border-primary b:focus:ring-3 b:focus:ring-primary/20"
            value={branch}
            onChange={(event) => onBranchChange(event.target.value)}
          >
            {clinicBranches.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <ChevronDown
            className="b:pointer-events-none b:absolute b:top-1/2 b:right-3 b:size-4 b:-translate-y-1/2 b:text-slate-500"
            aria-hidden="true"
          />
        </span>
      </label>

      <div className="b:rounded-[8px] b:border b:border-slate-200 b:p-3 b:sm:p-4">
        <div className="b:mb-4 b:flex b:items-center b:justify-between b:gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="b:size-11"
            aria-label="Previous month"
            disabled={month <= today.slice(0, 7)}
            onClick={() => setMonth(moveMonth(month, -1))}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <h4
            className="b:text-sm b:font-semibold b:text-slate-950"
            aria-live="polite"
          >
            {monthLabel}
          </h4>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="b:size-11"
            aria-label="Next month"
            onClick={() => setMonth(nextMonth)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>

        <table className="b:w-full b:table-fixed b:border-separate b:border-spacing-1">
          <caption className="b:sr-only">
            Choose an appointment date in {monthLabel}
          </caption>
          <thead>
            <tr>
              {weekdays.map((day) => (
                <th
                  key={day}
                  scope="col"
                  className="b:pb-2 b:text-xs b:font-medium b:text-slate-500"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: cellCount / 7 }, (_, week) => (
              <tr key={week}>
                {Array.from({ length: 7 }, (_, weekday) => {
                  const day = week * 7 + weekday - firstDay.getUTCDay() + 1
                  if (day < 1 || day > daysInMonth) return <td key={weekday} />
                  const value = `${month}-${String(day).padStart(2, "0")}`
                  const error = getScheduleError(value, now)
                  const selected = date === value
                  return (
                    <td key={weekday}>
                      <button
                        type="button"
                        disabled={!!error}
                        aria-pressed={selected}
                        aria-current={value === today ? "date" : undefined}
                        aria-label={`${formatAppointmentDate(value)}${error ? `: ${error}` : `, clinic hours ${getDateHours(value)}`}`}
                        title={error || getDateHours(value) || undefined}
                        onClick={() => chooseDate(value)}
                        className={cn(
                          "b:flex b:min-h-11 b:w-full b:items-center b:justify-center b:rounded-[8px] b:text-sm b:font-medium b:transition b:focus-visible:ring-3 b:focus-visible:ring-primary/30 b:focus-visible:outline-none b:disabled:cursor-not-allowed b:disabled:bg-slate-50 b:disabled:text-slate-300",
                          selected && !error
                            ? "b:bg-primary b:text-primary-foreground"
                            : "b:bg-white b:text-slate-700 b:enabled:hover:bg-primary/10",
                          value === today &&
                            !selected &&
                            !error &&
                            "b:ring-1 b:ring-primary"
                        )}
                      >
                        {day}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="b:mt-4 b:flex b:flex-wrap b:items-center b:justify-between b:gap-3 b:border-t b:border-slate-100 b:pt-3">
          <p className="b:text-xs b:text-slate-500">
            Sundays and past dates are unavailable.
          </p>
          <Button
            type="button"
            variant="outline"
            className="b:h-11"
            onClick={() => chooseDate(nextDate)}
          >
            <CalendarDays aria-hidden="true" /> Next clinic day
          </Button>
        </div>
      </div>

      <label className="b:grid b:gap-2 b:text-sm b:font-medium b:text-slate-700">
        <span>
          Appointment date <span className="b:text-red-600">*</span>
        </span>
        <input
          type="date"
          value={date}
          min={today}
          className="b:h-11 b:w-full b:rounded-[8px] b:border b:border-border b:bg-background b:px-3 b:text-sm b:outline-none b:focus:border-primary b:focus:ring-3 b:focus:ring-primary/20"
          onChange={(event) => chooseDate(event.target.value)}
          aria-invalid={!!dateError}
          aria-describedby={dateError ? "schedule-date-error" : undefined}
        />
        {dateError && (
          <span
            id="schedule-date-error"
            className="b:text-sm b:text-red-700"
            role="alert"
          >
            {dateError}
          </span>
        )}
      </label>

      <div
        className="b:rounded-[8px] b:border b:border-primary/20 b:bg-primary/10 b:p-4"
        aria-live="polite"
      >
        <div className="b:flex b:items-start b:gap-3">
          <Clock
            className="b:mt-0.5 b:size-5 b:shrink-0 b:text-primary"
            aria-hidden="true"
          />
          <div className="b:min-w-0">
            <p className="b:text-sm b:font-semibold b:text-primary">
              {date && !dateError
                ? formatAppointmentDate(date)
                : "Clinic hours"}
            </p>
            <p className="b:mt-1 b:text-sm b:leading-6 b:text-slate-700">
              {date && !dateError
                ? `${getDateHours(date)} · ${branch}`
                : clinicHours}
            </p>
            <p className="b:mt-2 b:text-xs b:leading-5 b:text-slate-600">
              Sundays closed. Visit during clinic hours on your selected date.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
