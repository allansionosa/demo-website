import type { Session } from "../types"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Mail,
  MapPin,
  ReceiptText,
  Search,
  ShieldCheck,
  Stethoscope,
  User,
  Users,
} from "lucide-react"

import { Button } from "./button"
import { ScheduleStep } from "./schedule-step"
import { useClinicClock } from "./hooks/use-clinic-clock"
import { usePortalConnection } from "./hooks/use-portal-connection"
import {
  applyPortalProfile,
  initialDetails,
  updateBookingDetails,
  type DetailsState,
} from "./lib/patient-details"
import {
  clinicBranches as branches,
  clinicHours,
  formatAppointmentDate,
  getDateHours,
  getScheduleError,
} from "./lib/scheduling"
import { cn } from "./lib/utils"
import { clearConfirmationAttempt } from "./lib/confirmation-attempt"
import { useQuery } from "@tanstack/react-query"
import {
  confirmAppointment,
  AppointmentConfirmationError,
  getCityBarangays,
  getItems,
  getProvinceCities,
  getProvinces,
  getZipcode,
  resendAppointmentEmail,
  type AppointmentConfirmationPayload,
  type BookingItem,
} from "./api"

type Service = Omit<BookingItem, "id" | "category"> & {
  id: number
  name: string
  category: string
  duration: "N/A"
  price: number
  prep: "N/A"
  itemRecordId: number
  itemCategory: string
}

type PaymentState = { accepted: boolean }

function itemToService(item: BookingItem): Service {
  return {
    ...item,
    id: item.itemId,
    name: item.itemDescription,
    category: item.categoryDescription,
    duration: "N/A",
    price: item.amount,
    prep: "N/A",
    itemRecordId: item.id,
    itemCategory: item.category,
  }
}

const steps = [
  { label: "Services", icon: Stethoscope },
  { label: "Schedule", icon: CalendarDays },
  { label: "Details", icon: User },
  { label: "Payment", icon: CreditCard },
  { label: "Review", icon: ReceiptText },
]

const servicesPerPage = 4

const initialPayment: PaymentState = { accepted: false }

const inputClass =
  "b:h-11 b:w-full b:rounded-[8px] b:border b:border-border b:bg-background b:px-3 b:text-sm b:text-foreground b:outline-none b:transition b:focus:border-primary b:focus:ring-3 b:focus:ring-primary/20 b:disabled:cursor-not-allowed b:disabled:bg-slate-100 b:disabled:text-slate-500"

const textAreaClass =
  "b:min-h-24 b:w-full b:resize-none b:rounded-[8px] b:border b:border-border b:bg-background b:px-3 b:py-2 b:text-sm b:text-foreground b:outline-none b:transition b:focus:border-primary b:focus:ring-3 b:focus:ring-primary/20"

function getTodayInputValue() {
  const today = new Date()
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset())
  return today.toISOString().slice(0, 10)
}

function formatMoney(value: number) {
  return `PHP ${value.toLocaleString("en-US")}`
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function formatPatientName(details: DetailsState) {
  return [
    details.patientFirstName,
    details.patientMiddle,
    details.patientLastName,
  ]
    .filter((value) => value.trim())
    .join(" ")
}

function formatPatientAddress(details: DetailsState) {
  return [
    details.patientStreetAddress,
    details.patientBarangayAddress,
    details.patientMunicipalityAddress,
    details.patientProvinceAddress,
    details.patientZipCodeAddress,
  ]
    .filter((value) => value.trim())
    .join(", ")
}

export function BookingFlow({ session, onSignIn }: { session: Session | null; onSignIn: () => void }) {
  const { now, refresh: refreshClinicClock } = useClinicClock()
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([])
  const [date, setDate] = useState("")
  const [branch, setBranch] = useState(branches[0])
  const [details, setDetails] = useState<DetailsState>(initialDetails)
  const [payment, setPayment] = useState<PaymentState>(initialPayment)
  const [showErrors, setShowErrors] = useState(false)
  const [confirmationCode, setConfirmationCode] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [isConfirming, setIsConfirming] = useState(false)
  const [submissionError, setSubmissionError] = useState("")
  const [emailSent, setEmailSent] = useState(false)
  const [emailMessage, setEmailMessage] = useState("")
  const [isResendingEmail, setIsResendingEmail] = useState(false)
  const submissionLock = useRef(false)
  const [confirmationPayload, setConfirmationPayload] =
    useState<AppointmentConfirmationPayload | null>(null)
  const portal = usePortalConnection(session, onSignIn, (profile) => {
    if (submissionLock.current)
      throw new Error("Wait for your booking confirmation before connecting.")
    if (confirmationPayload) {
      if (
        !confirmationPayload.usePortalProfile ||
        confirmationPayload.portalPatientNo !== profile.patientNo
      ) {
        throw new Error(
          "Sign in with the same patient account to retry this booking."
        )
      }
      return
    }
    setDetails((current) => applyPortalProfile(current, profile))
  })

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["items"],
    queryFn: () => getItems(),
  })

  const services = useMemo(
    () =>
      (data ?? [])
        .filter((item) => item.chargesType === "CHARGES")
        .map((item) => itemToService(item)),
    [data]
  )

  const selectedServices = useMemo(
    () => services.filter((service) => selectedServiceIds.includes(service.id)),
    [selectedServiceIds, services]
  )

  const subtotal = selectedServices.reduce(
    (total, service) => total + service.price,
    0
  )
  const estimatedTime = selectedServices.length > 0 ? "N/A" : "Pending"
  const paymentDue = subtotal
  const stepErrors = getStepErrors()
  const isFinalStep = currentStep === steps.length - 1

  function toggleService(id: number) {
    setSelectedServiceIds((current) =>
      current.includes(id)
        ? current.filter((serviceId) => serviceId !== id)
        : [...current, id]
    )
  }

  function updateDetails<K extends keyof DetailsState>(
    key: K,
    value: DetailsState[K]
  ) {
    setDetails((current) =>
      updateBookingDetails(current, key, value, Boolean(portal.connection))
    )
  }

  function updatePayment<K extends keyof PaymentState>(
    key: K,
    value: PaymentState[K]
  ) {
    setPayment((current) => ({ ...current, [key]: value }))
  }

  function getStepErrors() {
    if (currentStep === 0 && selectedServiceIds.length === 0) {
      return ["Select at least one examination or procedure."]
    }

    if (currentStep >= 1) {
      const scheduleError = getScheduleError(date)
      if (scheduleError) return [scheduleError]
      if (!branches.includes(branch)) return ["Choose a valid clinic branch."]
      if (currentStep === 1) return []
    }

    if (currentStep === 2) {
      const errors: string[] = []
      if (!details.firstName.trim()) errors.push("Enter your first name.")
      if (!details.lastName.trim()) errors.push("Enter your last name.")
      if (!details.email.trim()) {
        errors.push("Email is required.")
      } else if (!isEmail(details.email)) {
        errors.push("Enter a valid email address.")
      }

      if (!details.patientFirstName.trim()) {
        errors.push("Enter the patient first name.")
      }
      if (!details.patientLastName.trim()) {
        errors.push("Enter the patient last name.")
      }
      if (!details.patientDateOfBirth) {
        errors.push("Enter the patient date of birth.")
      }
      if (!details.patientSex) {
        errors.push("Choose the patient sex.")
      }
      if (!details.patientStreetAddress.trim()) {
        errors.push("Enter the patient street address.")
      }
      if (!details.patientProvinceAddress) {
        errors.push("Choose the patient province.")
      }
      if (!details.patientMunicipalityAddress) {
        errors.push("Choose the patient city or municipality.")
      }
      if (!details.patientBarangayAddress) {
        errors.push("Choose the patient barangay.")
      }

      if (details.attendeeType === "someone") {
        if (!details.relationship.trim()) {
          errors.push("Enter your relationship to the patient.")
        }
      }

      return errors
    }

    if (currentStep === 3 && !payment.accepted) return ["Please acknowledge that payment is due at the clinic."]

    return []
  }

  function goNext() {
    refreshClinicClock()
    if (currentStep >= 1 && getScheduleError(date)) {
      setCurrentStep(1)
      setShowErrors(true)
      return
    }
    if (stepErrors.length > 0) {
      setShowErrors(true)
      return
    }

    setShowErrors(false)
    setSubmissionError("")
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1))
  }

  function goBack() {
    setShowErrors(false)
    setSubmissionError("")
    setCurrentStep((step) => Math.max(step - 1, 0))
  }

  async function handleSubmit() {
    if (submissionLock.current || portal.blocked) return
    if (!isFinalStep) {
      goNext()
      return
    }

    refreshClinicClock()
    const scheduleError = getScheduleError(date)
    if (!confirmationPayload && (scheduleError || !branches.includes(branch))) {
      setCurrentStep(1)
      setShowErrors(true)
      return
    }

    setSubmissionError("")
    submissionLock.current = true
    setIsConfirming(true)

    try {
      const result = await sendAppointmentConfirmation()
      setConfirmationCode(result.appointmentNo || result.appointmentCode || "")
      setInvoiceNumber(result.invoiceNumber)
      setEmailSent(result.emailSent)
      setEmailMessage(result.emailMessage || "")
    } catch (error) {
      if (error instanceof AppointmentConfirmationError && !error.retryable) {
        setConfirmationPayload(null)
        clearConfirmationAttempt()
      }
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "Could not verify the booking confirmation. Retry to check this booking."
      )
    } finally {
      submissionLock.current = false
      setIsConfirming(false)
    }
  }

  async function sendAppointmentConfirmation() {
    // A lost response may follow a committed save. Always retry the original
    // snapshot, even if the service query refreshes before the retry.
    if (confirmationPayload) {
      return await confirmAppointment(
        confirmationPayload,
        portal.connection?.token
      )
    }
    const paymentMethodLabel = "Pay at clinic"

    const payload: AppointmentConfirmationPayload = {
      ...(portal.connection
        ? {
            usePortalProfile: true,
            portalPatientNo: portal.connection.profile.patientNo,
          }
        : {}),
      email: details.email,
      customerName: `${details.firstName} ${details.lastName}`.trim(),
      phone: details.phone,
      isForSomeoneElse: details.attendeeType === "someone",
      patientFirstName: details.patientFirstName,
      patientLastName: details.patientLastName,
      patientMiddle: details.patientMiddle,
      patientDateOfBirth: details.patientDateOfBirth,
      patientStreetAddress: details.patientStreetAddress,
      patientProvinceAddress: details.patientProvinceAddress,
      patientBarangayAddress: details.patientBarangayAddress,
      patientMunicipalityAddress: details.patientMunicipalityAddress,
      patientZipCodeAddress: details.patientZipCodeAddress,
      patientSex: details.patientSex,
      relationship:
        details.attendeeType === "someone" ? details.relationship : "Self",
      appointmentDate: date,
      appointmentTime: getDateHours(date) || "",
      branch,
      services: selectedServices.map((service) => ({
        id: service.id,
        name: service.name,
        category: service.category,
        duration: service.duration,
        quantity: 1,
        price: service.price,
        itemId: service.itemId,
        itemDescription: service.itemDescription,
        amount: service.amount,
        itemRecordId: service.itemRecordId,
        departmentId: service.departmentId,
        itemCategory: service.itemCategory,
        categoryDescription: service.categoryDescription,
        chargesType: service.chargesType,
      })),
      totalAmount: subtotal,
      amountPaid: 0,
      paymentType: paymentMethodLabel,
      paymentMethod: paymentMethodLabel,
      notes: details.notes,
    }
    setConfirmationPayload(payload)
    return await confirmAppointment(payload, portal.connection?.token)
  }

  async function retryConfirmationEmail() {
    if (submissionLock.current || !confirmationPayload) return
    submissionLock.current = true
    setIsResendingEmail(true)
    try {
      const result = await resendAppointmentEmail(
        confirmationPayload,
        portal.connection?.token
      )
      setEmailSent(result.emailSent)
      setEmailMessage(result.emailMessage || "")
    } catch {
      setEmailMessage(
        "Your appointment is confirmed, but the email could not be resent. Try again later."
      )
    } finally {
      submissionLock.current = false
      setIsResendingEmail(false)
    }
  }

  function resetForm() {
    clearConfirmationAttempt()
    setConfirmationPayload(null)
    submissionLock.current = false
    setEmailSent(false)
    setEmailMessage("")
    setIsResendingEmail(false)
    setCurrentStep(0)
    setSelectedServiceIds([])
    setDate("")
    setBranch(branches[0])
    setDetails(
      portal.connection
        ? applyPortalProfile(initialDetails, portal.connection.profile)
        : initialDetails
    )
    setPayment(initialPayment)
    setShowErrors(false)
    setConfirmationCode("")
    setInvoiceNumber("")
    setSubmissionError("")
    setIsConfirming(false)
  }

  if (confirmationCode) {
    return (
      <main className="b:min-h-svh b:bg-[var(--booking-surface)] b:px-4 b:py-6 b:text-foreground b:sm:px-6 b:lg:px-8">
        <div className="b:mx-auto b:flex b:min-h-[calc(100svh-3rem)] b:max-w-3xl b:items-center">
          <section className="b:w-full b:rounded-[8px] b:border b:border-primary/20 b:bg-white b:p-6 b:shadow-sm b:sm:p-8">
            <div className="b:mb-6 b:flex b:size-12 b:items-center b:justify-center b:rounded-full b:bg-primary/10 b:text-primary">
              <ShieldCheck className="b:size-6" aria-hidden="true" />
            </div>
            <p className="b:text-sm b:font-medium b:text-primary">
              Appointment confirmed
            </p>
            <h1 className="b:mt-2 b:text-3xl b:font-semibold b:text-slate-950">
              {confirmationCode}
            </h1>
            <p className="b:mt-3 b:max-w-2xl b:text-sm b:leading-6 b:text-slate-600">
              {emailSent ? (
                <>
                  Invoice {invoiceNumber} and your appointment confirmation were
                  sent to{" "}
                  <span className="b:font-medium b:text-slate-900">
                    {details.email}
                  </span>
                  .
                </>
              ) : (
                <>
                  Your appointment is saved with invoice {invoiceNumber}. The
                  confirmation email has not been sent yet.
                </>
              )}
            </p>

            {!emailSent && (
              <div className="b:mt-4 b:rounded-[8px] b:border b:border-amber-200 b:bg-amber-50 b:p-4">
                <p className="b:text-sm b:leading-6 b:text-amber-900" role="status">
                  {emailMessage ||
                    "You can retry the email without booking another appointment."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="b:mt-3 b:h-11"
                  disabled={isResendingEmail}
                  onClick={retryConfirmationEmail}
                >
                  <Mail aria-hidden="true" />
                  {isResendingEmail
                    ? "Resending email..."
                    : "Resend confirmation email"}
                </Button>
                {confirmationPayload?.usePortalProfile && (
                  <div className="b:mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={portal.connect}
                      disabled={portal.connecting || isResendingEmail}
                    >
                      Reconnect portal
                    </Button>
                    {portal.status && (
                      <p className="b:mt-2 b:text-sm b:text-amber-900" role="status">
                        {portal.status}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="b:mt-8 b:grid b:gap-3 b:sm:grid-cols-3">
              <SummaryMetric
                label="Schedule"
                value={`${formatAppointmentDate(date)}, ${getDateHours(date)}`}
                icon={<CalendarDays className="b:size-4" aria-hidden="true" />}
              />
              <SummaryMetric
                label="Services"
                value={`${selectedServices.length} selected`}
                icon={<Stethoscope className="b:size-4" aria-hidden="true" />}
              />
              <SummaryMetric
                label="Due at clinic"
                value={formatMoney(paymentDue)}
                icon={<CreditCard className="b:size-4" aria-hidden="true" />}
              />
            </div>

            <div className="b:mt-8 b:flex b:flex-col b:gap-3 b:sm:flex-row">
              <Button
                type="button"
                size="lg"
                className="b:h-11"
                onClick={resetForm}
                disabled={isResendingEmail}
              >
                <CalendarDays data-icon="inline-start" />
                Book another appointment
              </Button>
<a className="b:inline-flex b:items-center b:gap-2 b:text-sm b:font-medium" href={session ? "#/appointments" : "#/home"}>Return to {session ? "my appointments" : "website"}</a>
            </div>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="b:min-h-svh b:bg-[var(--booking-surface)] b:text-foreground">
      <div className="b:mx-auto b:flex b:max-w-7xl b:flex-col b:gap-6 b:px-4 b:py-5 b:sm:px-6 b:lg:px-8">
        <header className="b:flex b:flex-col b:gap-4 b:border-b b:border-slate-200 b:pb-5 b:lg:flex-row b:lg:items-end b:lg:justify-between">
          <div>
            <div className="b:mb-3 b:inline-flex b:items-center b:gap-2 b:rounded-[8px] b:border b:border-primary/20 b:bg-primary/10 b:px-3 b:py-1 b:text-sm b:font-medium b:text-primary">
              <Stethoscope className="b:size-4" aria-hidden="true" />
              Comlogik Medical Center
            </div>
            {/* <div className="pb-5">
              <img src="/hims-web.png" className="h-12 w-auto" />
            </div> */}
            <h1 className="b:text-3xl b:font-semibold b:text-slate-950 b:sm:text-4xl">
              Examination and procedure booking
            </h1>
          </div>
          <div className="b:flex b:flex-col b:gap-3 b:sm:flex-row b:sm:items-center">
            <a
              href={session ? "#/appointments" : "#/home"}
              className="b:inline-flex b:min-h-10 b:items-center b:justify-center b:gap-2 b:rounded-[8px] b:border b:border-primary/25 b:bg-white b:px-4 b:text-sm b:font-semibold b:text-primary b:shadow-sm b:transition b:hover:border-primary/50 b:hover:bg-primary/5"
            >
              <ShieldCheck className="b:size-4" aria-hidden="true" />
              Back to website
            </a>
            <div className="b:grid b:grid-cols-2 b:gap-3 b:sm:flex">
              <SummaryMetric
                label="Selected"
                value={String(selectedServices.length)}
                icon={<Check className="b:size-4" aria-hidden="true" />}
              />
              <SummaryMetric
                label="Amount"
                value={formatMoney(subtotal)}
                icon={<ReceiptText className="b:size-4" aria-hidden="true" />}
              />
            </div>
          </div>
        </header>

        <Stepper currentStep={currentStep} />

        <section
          className="b:flex b:flex-col b:gap-3 b:rounded-[8px] b:border b:border-primary/20 b:bg-white b:p-4 b:sm:flex-row b:sm:items-center b:sm:justify-between"
          aria-label="Patient portal connection"
        >
          <div>
            <p className="b:text-sm b:font-semibold b:text-slate-950">
              {portal.connection
                ? `Booking account: ${portal.connection.profile.fullName}`
                : "Already a patient? Reuse your portal profile."}
            </p>
            <p className="b:mt-1 b:text-sm b:text-slate-600" role="status">
              {portal.status ||
                (portal.connection
                  ? "Your own bookings will appear in your patient portal. Choose who the appointment is for in Details."
                  : "Sign in to fill your patient details, or continue with manual entry.")}
            </p>
          </div>
          <div className="b:flex b:flex-wrap b:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={portal.connect}
              disabled={portal.connecting || isConfirming || isResendingEmail}
            >
              {portal.connecting
                ? "Loading profile..."
                : portal.connection
                  ? "Refresh patient profile"
                  : "Sign in to patient portal"}
            </Button>
            
          </div>
        </section>

        <div className="b:grid b:gap-6 b:lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="b:min-w-0 b:rounded-[8px] b:border b:border-slate-200 b:bg-white b:shadow-sm">
            <div className="b:border-b b:border-slate-200 b:px-4 b:py-4 b:sm:px-6">
              <p className="b:text-sm b:font-medium b:text-primary">
                Step {currentStep + 1} of {steps.length}
              </p>
              <h2 className="b:mt-1 b:text-xl b:font-semibold b:text-slate-950">
                {steps[currentStep].label}
              </h2>
            </div>

            <div className="b:px-4 b:py-5 b:sm:px-6">
              {currentStep === 0 && (
                <ServicesStep
                  services={services}
                  isLoading={isLoading}
                  isError={isError}
                  onRetry={() => { void refetch() }}
                  selectedServiceIds={selectedServiceIds}
                  onToggle={toggleService}
                />
              )}
              {currentStep === 1 && (
                <ScheduleStep
                  date={date}
                  branch={branch}
                  now={now}
                  onDateChange={setDate}
                  onBranchChange={setBranch}
                />
              )}
              {currentStep === 2 && (
                <DetailsStep
                  details={details}
                  onChange={updateDetails}
                  linked={Boolean(portal.connection)}
                />
              )}
              {currentStep === 3 && (
                <PaymentStep
                  payment={payment}
                  paymentDue={paymentDue}
                  onChange={updatePayment}
                />
              )}
              {currentStep === 4 && (
                <ReviewStep
                  selectedServices={selectedServices}
                  date={date}
                  branch={branch}
                  details={details}
                  paymentDue={paymentDue}
                  linked={Boolean(portal.connection)}
                />
              )}

              {showErrors && stepErrors.length > 0 && (
                <div className="b:mt-5 b:rounded-[8px] b:border b:border-red-200 b:bg-red-50 b:p-3 b:text-sm b:text-red-800">
                  <p className="b:font-medium">Before continuing</p>
                  <ul className="b:mt-2 b:list-disc b:space-y-1 b:pl-5">
                    {stepErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {submissionError && (
                <div className="b:mt-5 b:rounded-[8px] b:border b:border-red-200 b:bg-red-50 b:p-3 b:text-sm b:text-red-800">
                  {submissionError}
                </div>
              )}
            </div>

            <div className="b:flex b:flex-col-reverse b:gap-3 b:border-t b:border-slate-200 b:px-4 b:py-4 b:sm:flex-row b:sm:justify-between b:sm:px-6">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="b:h-11"
                onClick={goBack}
                disabled={
                  currentStep === 0 ||
                  isConfirming ||
                  (isFinalStep && confirmationPayload !== null)
                }
              >
                <ChevronLeft data-icon="inline-start" />
                Back
              </Button>
              <Button
                type="button"
                size="lg"
                className="b:h-11"
                onClick={handleSubmit}
                disabled={isConfirming || portal.connecting || portal.blocked}
              >
                {isConfirming
                  ? "Confirming appointment..."
                  : isFinalStep
                    ? "Confirm appointment"
                    : "Continue"}
                {isFinalStep ? (
                  <ShieldCheck data-icon="inline-end" />
                ) : (
                  <ChevronRight data-icon="inline-end" />
                )}
              </Button>
            </div>
          </section>

          <BookingSummary
            selectedServices={selectedServices}
            subtotal={subtotal}
            estimatedTime={estimatedTime}
            date={date}
            branch={branch}
            paymentDue={paymentDue}
          />
        </div>
      </div>
    </main>
  )
}

function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Booking progress" className="b:overflow-x-auto b:pb-1">
      <ol className="b:grid b:min-w-[45rem] b:grid-cols-5 b:overflow-hidden b:rounded-[8px] b:border b:border-slate-200 b:bg-white b:shadow-sm">
        {steps.map((step, index) => {
          const StepIcon = step.icon
          const isComplete = index < currentStep
          const isCurrent = index === currentStep

          return (
            <li
              key={step.label}
              className={cn(
                "b:flex b:items-center b:gap-3 b:border-r b:border-slate-200 b:px-4 b:py-3 b:last:border-r-0",
                isCurrent && "b:bg-primary/10",
                isComplete && "b:bg-primary/5"
              )}
            >
              <span
                className={cn(
                  "b:flex b:size-8 b:shrink-0 b:items-center b:justify-center b:rounded-full b:border b:text-sm b:font-semibold",
                  isCurrent &&
                    "b:border-primary b:bg-primary b:text-primary-foreground b:shadow-sm",
                  isComplete &&
                    "b:border-primary/70 b:bg-primary/80 b:text-primary-foreground",
                  !isCurrent &&
                    !isComplete &&
                    "b:border-slate-200 b:bg-slate-50 b:text-slate-500"
                )}
              >
                {isComplete ? (
                  <Check className="b:size-4" aria-hidden="true" />
                ) : (
                  <StepIcon className="b:size-4" aria-hidden="true" />
                )}
              </span>
              <span className="b:min-w-0">
                <span className="b:block b:text-xs b:text-slate-500">
                  Step {index + 1}
                </span>
                <span className="b:block b:truncate b:text-sm b:font-medium b:text-slate-900">
                  {step.label}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function ServicesStep({
  services,
  isLoading,
  isError,
  onRetry,
  selectedServiceIds,
  onToggle,
}: {
  services: Service[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  selectedServiceIds: number[]
  onToggle: (id: number) => void
}) {
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const normalizedSearchTerm = searchTerm.trim().toLowerCase()
  const filteredServices = normalizedSearchTerm
    ? services.filter((service) =>
        [service.name, service.category, service.prep].some((value) =>
          value.toLowerCase().includes(normalizedSearchTerm)
        )
      )
    : services
  const pageCount = Math.max(
    1,
    Math.ceil(filteredServices.length / servicesPerPage)
  )
  const activePage = Math.min(currentPage, pageCount)
  const pageStart = (activePage - 1) * servicesPerPage
  const visibleServices = filteredServices.slice(
    pageStart,
    pageStart + servicesPerPage
  )

  return (
    <div className="b:grid b:gap-4">
      <div className="b:flex b:flex-col b:gap-3 b:sm:flex-row b:sm:items-center b:sm:justify-between">
        <label className="b:relative b:min-w-0 b:sm:max-w-md b:sm:flex-1">
          <Search
            className="b:pointer-events-none b:absolute b:top-1/2 b:left-3 b:size-4 b:-translate-y-1/2 b:text-slate-400"
            aria-hidden="true"
          />
          <input
            className={cn(inputClass, "b:pl-10")}
            type="search"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value)
              setCurrentPage(1)
            }}
            placeholder="Search examinations or procedures"
            aria-label="Search services"
          />
        </label>
        <p className="b:text-sm b:font-medium b:text-slate-500" aria-live="polite">
          Showing {filteredServices.length > 0 ? pageStart + 1 : 0}
          {filteredServices.length > 0 &&
            `–${pageStart + visibleServices.length}`}{" "}
          of {filteredServices.length}
        </p>
      </div>

      {isLoading ? (
        <div className="b:rounded-[8px] b:border b:border-dashed b:border-slate-300 b:bg-slate-50 b:p-6 b:text-center b:text-sm b:text-slate-600">
          Loading services...
        </div>
      ) : isError ? (
        <div className="b:rounded-[8px] b:border b:border-red-200 b:bg-red-50 b:p-6 b:text-center b:text-sm b:text-red-800">
          Could not load services. Please try again.
          <Button type="button" variant="outline" onClick={onRetry}>Retry services</Button>
        </div>
      ) : filteredServices.length > 0 ? (
        <div className="b:grid b:gap-3 b:md:grid-cols-2">
          {visibleServices.map((service) => {
            const isSelected = selectedServiceIds.includes(service.id)

            return (
              <button
                key={service.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onToggle(service.id)}
                className={cn(
                  "b:min-h-36 b:rounded-[8px] b:border b:bg-white b:p-4 b:text-left b:transition b:hover:border-primary/50 b:hover:bg-primary/5 b:focus:ring-3 b:focus:ring-primary/20 b:focus:outline-none",
                  isSelected
                    ? "b:border-primary b:bg-primary/10 b:shadow-sm"
                    : "b:border-slate-200"
                )}
              >
                <div className="b:flex b:items-start b:justify-between b:gap-3">
                  <div className="b:min-w-0">
                    <span
                      className={cn(
                        "b:inline-flex b:rounded-full b:px-2 b:py-1 b:text-xs b:font-medium",
                        service.category === "b:Examination"
                          ? "b:bg-primary/10 b:text-primary"
                          : "b:bg-primary/15 b:text-primary"
                      )}
                    >
                      {service.itemCategory}
                    </span>
                    <h3 className="b:mt-3 b:text-base b:font-semibold b:text-slate-950">
                      {service.name}
                    </h3>
                  </div>
                  <span
                    className={cn(
                      "b:flex b:size-6 b:shrink-0 b:items-center b:justify-center b:rounded-full b:border",
                      isSelected
                        ? "b:border-primary b:bg-primary b:text-primary-foreground"
                        : "b:border-slate-300 b:text-transparent"
                    )}
                  >
                    <Check className="b:size-4" aria-hidden="true" />
                  </span>
                </div>
                <div className="b:mt-4 b:grid b:grid-cols-2 b:gap-2 b:text-sm b:text-slate-600">
                  <span className="b:inline-flex b:items-center b:gap-1.5">
                    <Clock
                      className="b:size-4 b:text-slate-400"
                      aria-hidden="true"
                    />
                    {service.duration}
                  </span>
                  <span className="b:font-medium b:text-slate-950">
                    {formatMoney(service.price)}
                  </span>
                </div>
                <p className="b:mt-3 b:text-sm b:leading-5 b:text-slate-600">
                  {service.prep}
                </p>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="b:rounded-[8px] b:border b:border-dashed b:border-slate-300 b:bg-slate-50 b:p-6 b:text-center b:text-sm b:text-slate-600">
          No services found.
        </div>
      )}

      {!isLoading && !isError && filteredServices.length > 0 && (
        <nav
          aria-label="Services pagination"
          className="b:flex b:flex-wrap b:items-center b:justify-between b:gap-3"
        >
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="b:h-11"
            disabled={activePage === 1}
            onClick={() => setCurrentPage(activePage - 1)}
          >
            <ChevronLeft data-icon="inline-start" aria-hidden="true" />
            Previous
          </Button>
          <p
            className="b:order-first b:w-full b:text-center b:text-sm b:text-slate-500 b:sm:order-none b:sm:w-auto"
            aria-live="polite"
          >
            Page {activePage} of {pageCount}
          </p>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="b:h-11"
            disabled={activePage === pageCount}
            onClick={() => setCurrentPage(activePage + 1)}
          >
            Next
            <ChevronRight data-icon="inline-end" aria-hidden="true" />
          </Button>
        </nav>
      )}
    </div>
  )
}

function DetailsStep({
  details,
  onChange,
  linked,
}: {
  details: DetailsState
  linked: boolean
  onChange: <K extends keyof DetailsState>(
    key: K,
    value: DetailsState[K]
  ) => void
}) {
  const selectedProvince = details.patientProvinceAddress
  const selectedMunicipality = details.patientMunicipalityAddress
  const selectedBarangay = details.patientBarangayAddress

  const { data: provinces = [], isLoading: isLoadingProvinces } = useQuery({
    queryKey: ["address", "provinces"],
    queryFn: () => getProvinces(),
  })

  const { data: municipalities = [], isLoading: isLoadingMunicipalities } =
    useQuery({
      queryKey: ["address", "municipalities", selectedProvince],
      queryFn: () => getProvinceCities(selectedProvince),
      enabled: Boolean(selectedProvince),
    })

  const { data: barangays = [], isLoading: isLoadingBarangays } = useQuery({
    queryKey: ["address", "barangays", selectedProvince, selectedMunicipality],
    queryFn: () => getCityBarangays(selectedProvince, selectedMunicipality),
    enabled: Boolean(selectedProvince && selectedMunicipality),
  })

  const { data: zipcode = "" } = useQuery({
    queryKey: [
      "address",
      "zipcode",
      selectedProvince,
      selectedMunicipality,
      selectedBarangay,
    ],
    queryFn: () =>
      getZipcode(selectedProvince, selectedMunicipality, selectedBarangay),
    enabled: Boolean(
      selectedProvince && selectedMunicipality && selectedBarangay
    ),
  })

  useEffect(() => {
    const normalizedZipcode = String(zipcode ?? "").trim()

    if (
      normalizedZipcode &&
      normalizedZipcode !== details.patientZipCodeAddress
    ) {
      onChange("patientZipCodeAddress", normalizedZipcode)
    }
  }, [details.patientZipCodeAddress, onChange, zipcode])

  function handleProvinceChange(value: string) {
    onChange("patientProvinceAddress", value)
    onChange("patientMunicipalityAddress", "")
    onChange("patientBarangayAddress", "")
    onChange("patientZipCodeAddress", "")
  }

  function handleMunicipalityChange(value: string) {
    onChange("patientMunicipalityAddress", value)
    onChange("patientBarangayAddress", "")
    onChange("patientZipCodeAddress", "")
  }

  function handleBarangayChange(value: string) {
    onChange("patientBarangayAddress", value)
    onChange("patientZipCodeAddress", "")
  }

  return (
    <div className="b:grid b:gap-5">
      <p className="b:text-sm b:text-slate-600">
        Booking contact — confirmation emails are sent to this address.
      </p>
      <div className="b:grid b:gap-4 b:md:grid-cols-2">
        <Field label="First name" required>
          <input
            className={inputClass}
            value={details.firstName}
            onChange={(event) => onChange("firstName", event.target.value)}
            autoComplete="given-name"
          />
        </Field>
        <Field label="Last name" required>
          <input
            className={inputClass}
            value={details.lastName}
            onChange={(event) => onChange("lastName", event.target.value)}
            autoComplete="family-name"
          />
        </Field>
        <Field label="Email" required icon={<Mail className="b:size-4" />}>
          <input
            className={inputClass}
            type="email"
            value={details.email}
            onChange={(event) => onChange("email", event.target.value)}
            autoComplete="email"
          />
        </Field>
        <Field label="Phone">
          <input
            className={inputClass}
            value={details.phone}
            onChange={(event) => onChange("phone", event.target.value)}
            autoComplete="tel"
          />
        </Field>
      </div>

      <div>
        <p className="b:mb-2 b:text-sm b:font-medium b:text-slate-700">
          Appointment is for
        </p>
        <div className="b:grid b:gap-2 b:sm:grid-cols-2">
          <ChoiceButton
            active={details.attendeeType === "self"}
            icon={<User className="b:size-4" aria-hidden="true" />}
            label="Myself"
            onClick={() => onChange("attendeeType", "self")}
          />
          <ChoiceButton
            active={details.attendeeType === "someone"}
            icon={<Users className="b:size-4" aria-hidden="true" />}
            label="Someone else"
            onClick={() => onChange("attendeeType", "someone")}
          />
        </div>
      </div>

      <section className="b:grid b:gap-4">
        <h3 className="b:text-sm b:font-semibold b:text-slate-950">
          Patient information
        </h3>
        <p className="b:text-sm b:text-slate-600">
          {details.attendeeType === "someone"
            ? "Enter the other patient’s details. This booking won’t be added to your own patient record or portal appointments."
            : linked
              ? "Identity details come from your registered patient profile. Contact the clinic to correct them. You can complete or update the address for this visit below."
              : "Enter your own patient details for this appointment."}
        </p>
        {linked &&
          details.attendeeType === "self" &&
          (!details.patientFirstName ||
            !details.patientLastName ||
            !details.patientDateOfBirth ||
            !details.patientSex) && (
            <p
              className="b:rounded-[8px] b:border b:border-amber-200 b:bg-amber-50 b:p-3 b:text-sm b:text-amber-900"
              role="status"
            >
              Your registered identity is incomplete. Contact the clinic to
              update it, or choose Use manual entry above.
            </p>
          )}

        <div className="b:grid b:gap-4 b:md:grid-cols-3">
          <Field label="Patient first name" required>
            <input
              className={inputClass}
              value={details.patientFirstName}
              onChange={(event) =>
                onChange("patientFirstName", event.target.value)
              }
              disabled={details.attendeeType === "self"}
              autoComplete="given-name"
            />
          </Field>
          <Field label="Patient middle name">
            <input
              className={inputClass}
              value={details.patientMiddle}
              disabled={linked && details.attendeeType === "self"}
              onChange={(event) =>
                onChange("patientMiddle", event.target.value)
              }
            />
          </Field>
          <Field label="Patient last name" required>
            <input
              className={inputClass}
              value={details.patientLastName}
              onChange={(event) =>
                onChange("patientLastName", event.target.value)
              }
              disabled={details.attendeeType === "self"}
              autoComplete="family-name"
            />
          </Field>
        </div>

        <div className="b:grid b:gap-4 b:md:grid-cols-3">
          <Field label="Date of birth" required>
            <input
              className={inputClass}
              type="date"
              disabled={linked && details.attendeeType === "self"}
              max={getTodayInputValue()}
              value={details.patientDateOfBirth}
              onChange={(event) =>
                onChange("patientDateOfBirth", event.target.value)
              }
            />
          </Field>
          <Field label="Sex" required>
            <select
              className={inputClass}
              value={details.patientSex}
              disabled={linked && details.attendeeType === "self"}
              onChange={(event) => onChange("patientSex", event.target.value)}
            >
              <option value="">Choose sex</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </Field>

          {details.attendeeType === "someone" && (
            <Field label="Relationship" required>
              <input
                className={inputClass}
                value={details.relationship}
                onChange={(event) =>
                  onChange("relationship", event.target.value)
                }
              />
            </Field>
          )}
        </div>
      </section>

      <section className="b:grid b:gap-4">
        <h3 className="b:text-sm b:font-semibold b:text-slate-950">
          Patient address
        </h3>

        <Field label="Street address" required>
          <input
            className={inputClass}
            value={details.patientStreetAddress}
            onChange={(event) =>
              onChange("patientStreetAddress", event.target.value)
            }
            autoComplete="street-address"
          />
        </Field>

        <div className="b:grid b:gap-4 b:md:grid-cols-2">
          <Field label="Province" required>
            <select
              className={inputClass}
              value={selectedProvince}
              onChange={(event) => handleProvinceChange(event.target.value)}
            >
              <option value="">
                {isLoadingProvinces
                  ? "Loading provinces..."
                  : "Choose province"}
              </option>
              {provinces.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
          </Field>
          <Field label="City/Municipality" required>
            <select
              className={inputClass}
              value={selectedMunicipality}
              onChange={(event) => handleMunicipalityChange(event.target.value)}
              disabled={!selectedProvince || isLoadingMunicipalities}
            >
              <option value="">
                {isLoadingMunicipalities
                  ? "Loading cities..."
                  : "Choose city or municipality"}
              </option>
              {municipalities.map((municipality) => (
                <option key={municipality} value={municipality}>
                  {municipality}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="b:grid b:gap-4 b:md:grid-cols-2">
          <Field label="Barangay" required>
            <select
              className={inputClass}
              value={selectedBarangay}
              onChange={(event) => handleBarangayChange(event.target.value)}
              disabled={
                !selectedProvince || !selectedMunicipality || isLoadingBarangays
              }
            >
              <option value="">
                {isLoadingBarangays
                  ? "Loading barangays..."
                  : "Choose barangay"}
              </option>
              {barangays.map((barangay) => (
                <option key={barangay} value={barangay}>
                  {barangay}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ZIP code">
            <input
              className={inputClass}
              value={details.patientZipCodeAddress}
              onChange={(event) =>
                onChange("patientZipCodeAddress", event.target.value)
              }
              autoComplete="postal-code"
            />
          </Field>
        </div>
      </section>

      <Field label="Notes">
        <textarea
          className={textAreaClass}
          value={details.notes}
          onChange={(event) => onChange("notes", event.target.value)}
        />
      </Field>
    </div>
  )
}

function PaymentStep({ payment, paymentDue, onChange }: {
  payment: PaymentState
  paymentDue: number
  onChange: <K extends keyof PaymentState>(key: K, value: PaymentState[K]) => void
}) {
  return <div className="b:grid b:gap-5">
    <h3 className="b:text-base b:font-semibold">Pay at the clinic</h3>
    <p className="b:text-sm b:leading-6 b:text-slate-600">No payment is collected online. The clinic will confirm your charges and collect payment during your visit.</p>
    <p className="b:text-xl b:font-semibold">Estimated total: {formatMoney(paymentDue)}</p>
    <label className="b:flex b:items-start b:gap-3 b:text-sm b:leading-6">
      <input type="checkbox" className="b:mt-1 b:size-4 b:accent-primary" checked={payment.accepted} onChange={event => onChange("accepted", event.target.checked)} />
      I understand that payment is due at the clinic.
    </label>
  </div>
}

function ReviewStep({
  selectedServices,
  date,
  branch,
  details,
  paymentDue,
  linked,
}: {
  selectedServices: Service[]
  date: string
  branch: string
  details: DetailsState
  paymentDue: number
  linked: boolean
}) {
  return (
    <div className="b:grid b:gap-5">
      <ReviewBlock title="Appointment">
        <ReviewRow label="Date" value={formatAppointmentDate(date)} />
        <ReviewRow
          label="Clinic hours (PHT)"
          value={getDateHours(date) || clinicHours}
        />
        <ReviewRow label="Branch" value={branch} />
      </ReviewBlock>

      <ReviewBlock title="Selected services">
        <div className="b:grid b:gap-2">
          {selectedServices.map((service) => (
            <div
              key={service.id}
              className="b:flex b:items-center b:justify-between b:gap-3 b:text-sm"
            >
              <span className="b:text-slate-700">{service.name}</span>
              <span className="b:font-medium b:text-slate-950">
                {formatMoney(service.price)}
              </span>
            </div>
          ))}
        </div>
      </ReviewBlock>

      <ReviewBlock title="Contact and patient">
        <ReviewRow
          label="Booking for"
          value={
            details.attendeeType === "someone"
              ? "Someone else (separate patient record)"
              : linked
                ? "Myself — connected patient profile"
                : "Myself — manual entry"
          }
        />
        <ReviewRow
          label="Contact"
          value={`${details.firstName} ${details.lastName}`}
        />
        <ReviewRow label="Email" value={details.email} />
        <ReviewRow label="Patient" value={formatPatientName(details)} />
        <ReviewRow label="Date of birth" value={details.patientDateOfBirth} />
        <ReviewRow label="Sex" value={details.patientSex} />
        <ReviewRow label="Address" value={formatPatientAddress(details)} />
        <ReviewRow
          label="Relationship"
          value={
            details.attendeeType === "self" ? "Self" : details.relationship
          }
        />
      </ReviewBlock>

      <ReviewBlock title="Payment">
        <ReviewRow label="Collected online" value="PHP 0" />
        <ReviewRow
          label="Method"
          value="Pay at clinic"
        />
        <ReviewRow label="Due at clinic" value={formatMoney(paymentDue)} />
      </ReviewBlock>
    </div>
  )
}

function BookingSummary({
  selectedServices,
  subtotal,
  estimatedTime,
  date,
  branch,
  paymentDue,
}: {
  selectedServices: Service[]
  subtotal: number
  estimatedTime: string
  date: string
  branch: string
  paymentDue: number
}) {
  return (
    <aside className="b:h-fit b:rounded-[8px] b:border b:border-slate-200 b:bg-white b:p-4 b:shadow-sm b:lg:sticky b:lg:top-5">
      <h2 className="b:text-base b:font-semibold b:text-slate-950">
        Booking summary
      </h2>
      <div className="b:mt-4 b:grid b:gap-3">
        <SummaryLine
          icon={<Stethoscope className="b:size-4" aria-hidden="true" />}
          label="Services"
          value={
            selectedServices.length
              ? `${selectedServices.length} selected`
              : "None selected"
          }
        />
        <SummaryLine
          icon={<Clock className="b:size-4" aria-hidden="true" />}
          label="Estimated time"
          value={estimatedTime}
        />
        <SummaryLine
          icon={<CalendarDays className="b:size-4" aria-hidden="true" />}
          label="Schedule"
          value={formatAppointmentDate(date)}
        />
        <SummaryLine
          icon={<Clock className="b:size-4" aria-hidden="true" />}
          label="Clinic hours (PHT)"
          value={getDateHours(date) || clinicHours}
        />
        <SummaryLine
          icon={<MapPin className="b:size-4" aria-hidden="true" />}
          label="Branch"
          value={branch}
        />
      </div>

      <div className="b:my-4 b:border-t b:border-slate-200" />

      <div className="b:space-y-2">
        {selectedServices.map((service) => (
          <div
            key={service.id}
            className="b:flex b:items-start b:justify-between b:gap-3 b:text-sm"
          >
            <span className="b:text-slate-600">{service.name}</span>
            <span className="b:shrink-0 b:font-medium b:text-slate-950">
              {formatMoney(service.price)}
            </span>
          </div>
        ))}
      </div>

      <div className="b:mt-4 b:rounded-[8px] b:bg-slate-50 b:p-3">
        <div className="b:flex b:justify-between b:gap-3 b:text-sm b:text-slate-600">
          <span>Total</span>
          <span>{formatMoney(subtotal)}</span>
        </div>
        <div className="b:mt-2 b:flex b:justify-between b:gap-3 b:text-sm b:font-semibold b:text-slate-950">
          <span>Due now</span>
          <span>{formatMoney(paymentDue)}</span>
        </div>
      </div>
    </aside>
  )
}

function Field({
  label,
  required,
  icon,
  children,
}: {
  label: string
  required?: boolean
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="b:grid b:gap-2 b:text-sm b:font-medium b:text-slate-700">
      <span className="b:inline-flex b:items-center b:gap-2">
        {icon}
        {label}
        {required && <span className="b:text-red-600">*</span>}
      </span>
      {children}
    </label>
  )
}

function ChoiceButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "b:flex b:min-h-12 b:items-center b:gap-3 b:rounded-[8px] b:border b:px-3 b:py-2 b:text-left b:text-sm b:font-medium b:transition b:focus:ring-3 b:focus:ring-primary/20 b:focus:outline-none",
        active
          ? "b:border-primary b:bg-primary/10 b:text-primary"
          : "b:border-slate-200 b:bg-white b:text-slate-700 b:hover:border-primary/50 b:hover:bg-primary/5"
      )}
    >
      <span
        className={cn(
          "b:flex b:size-8 b:shrink-0 b:items-center b:justify-center b:rounded-full",
          active
            ? "b:bg-primary b:text-primary-foreground"
            : "b:bg-slate-100 b:text-slate-500"
        )}
      >
        {icon}
      </span>
      <span>{label}</span>
    </button>
  )
}

function SummaryMetric({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: ReactNode
}) {
  return (
    <div className="b:rounded-[8px] b:border b:border-slate-200 b:bg-white b:px-3 b:py-2 b:shadow-sm">
      <div className="b:flex b:items-center b:gap-2 b:text-xs b:font-medium b:text-slate-500">
        {icon}
        {label}
      </div>
      <p className="b:mt-1 b:text-sm b:font-semibold b:text-slate-950">{value}</p>
    </div>
  )
}

function SummaryLine({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="b:flex b:items-start b:gap-3 b:text-sm">
      <span className="b:mt-0.5 b:text-primary">{icon}</span>
      <span className="b:min-w-0 b:flex-1">
        <span className="b:block b:text-slate-500">{label}</span>
        <span className="b:block b:font-medium b:break-words b:text-slate-950">
          {value}
        </span>
      </span>
    </div>
  )
}

function ReviewBlock({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="b:rounded-[8px] b:border b:border-slate-200 b:p-4">
      <h3 className="b:text-sm b:font-semibold b:text-slate-950">{title}</h3>
      <div className="b:mt-3 b:grid b:gap-2">{children}</div>
    </section>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="b:flex b:items-start b:justify-between b:gap-4 b:text-sm">
      <span className="b:text-slate-500">{label}</span>
      <span className="b:text-right b:font-medium b:text-slate-950">{value}</span>
    </div>
  )
}

export default BookingFlow
