import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, CreditCard, Landmark, ShieldCheck, Smartphone, Wallet } from 'lucide-react';
import api from '../services/api';
import { getBusById } from '../services/busService';
import Stepper from '../components/ui/Stepper';

const Payment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const booking = useMemo(() => location.state || {}, [location.state]);
  const routeBus = booking.bus || null;
  const routeTravelDate = booking.travelDate || '';
  const routeSelectedSeats = booking.selectedSeats || [];
  const routeTotalFare = booking.totalFare;
  const routeFarePerSeat = booking.farePerSeat || 0;
  const routeBusId = booking.busId || null;

  const [busData, setBusData] = useState(routeBus);
  const [loadingDetails, setLoadingDetails] = useState(!routeBus && Boolean(routeBusId));
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [showCoupon, setShowCoupon] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [isRazorpayReady, setIsRazorpayReady] = useState(Boolean(window.Razorpay));
  const paymentRequestInFlight = useRef(false);

  useEffect(() => {
    let mounted = true;
    const loadDetails = async () => {
      if (routeBus) {
        setBusData(routeBus);
        setLoadingDetails(false);
        return;
      }
      if (!routeBusId) {
        setBusData(null);
        setLoadingDetails(false);
        return;
      }
      setLoadingDetails(true);
      try {
        let data = await getBusById(routeBusId);
        if (data && data.data) data = data.data;
        if (Array.isArray(data)) data = data[0] || null;
        if (!mounted) return;
        setBusData(data || null);
      } catch (err) {
        console.error('Failed to load bus details for payment page', err);
        if (!mounted) return;
        setError('Unable to load booking details. Please return and try again.');
      } finally {
        if (mounted) setLoadingDetails(false);
      }
    };

    loadDetails();
    return () => {
      mounted = false;
    };
  }, [routeBusId, routeBus]);

  const [paymentMethod, setPaymentMethod] = useState('upi');
  const createPassenger = (data = {}) => ({
    name: '',
    email: '',
    phone: '',
    ...data,
  });

  const effectiveBus = busData || routeBus;
  const effectiveBusId = routeBusId || effectiveBus?._id || effectiveBus?.id || '';
  const effectiveSelectedSeats = routeSelectedSeats;
  const effectiveFarePerSeat = routeFarePerSeat || effectiveBus?.fare || 0;
  const effectiveTotalFare = routeTotalFare !== undefined ? routeTotalFare : effectiveFarePerSeat * effectiveSelectedSeats.length;
  const effectiveTravelDate = routeTravelDate || effectiveBus?.travelDate || '';

  const [passengerForms, setPassengerForms] = useState([
    createPassenger({
      name: booking.passengerName || '',
      email: booking.email || '',
      phone: booking.phone || '',
    }),
  ]);

  const loggedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (e) {
      return {};
    }
  }, []);

  const [guardian, setGuardian] = useState({
    name: loggedUser.guardian?.name || '',
    phone: loggedUser.guardian?.phone || '',
    email: loggedUser.guardian?.email || '',
    relationship: loggedUser.guardian?.relationship || 'Parent / Guardian',
  });

  useEffect(() => {
    setPassengerForms((prev) => {
      const maxPassengers = Math.max(1, effectiveSelectedSeats.length);
      if (prev.length === 0) return [createPassenger()];
      if (prev.length > maxPassengers) return prev.slice(0, maxPassengers);
      return prev;
    });
  }, [effectiveSelectedSeats.length]);

  const serviceFee = Math.round(effectiveTotalFare * 0.05);
  const taxes = Math.round(effectiveTotalFare * 0.08);
  const amountPayable = effectiveTotalFare + serviceFee + taxes;

  const displayFrom = effectiveBus?.from || '';
  const displayTo = effectiveBus?.to || '';
  const displayDeparture = effectiveBus?.departureTime || '';
  const displayArrival = effectiveBus?.arrivalTime || '';
  const displayBusType = effectiveBus?.busType || '';

  const paymentOptions = [
    { id: 'upi', label: 'UPI', description: 'Instant', icon: <Smartphone className="h-4 w-4" /> },
    { id: 'scan-pay', label: 'Scan & Pay', description: 'UPI QR', icon: <Smartphone className="h-4 w-4" /> },
    { id: 'card', label: 'Card', description: 'Visa/Mastercard', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'wallet', label: 'Wallet', description: 'Paytm/PhonePe', icon: <Wallet className="h-4 w-4" /> },
    { id: 'net-banking', label: 'Net Banking', description: 'Bank transfer', icon: <Landmark className="h-4 w-4" /> },
  ];

  useEffect(() => {
    if (window.Razorpay) {
      setIsRazorpayReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setIsRazorpayReady(true);
    script.onerror = () => setError('Razorpay checkout could not be loaded. Please refresh the page and try again.');
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  const addPassengerForm = () => {
    if (passengerForms.length >= effectiveSelectedSeats.length) {
      return;
    }

    setPassengerForms((prev) => [...prev, createPassenger()]);
  };

  const removePassengerForm = (index) => {
    if (passengerForms.length <= 1) {
      return;
    }

    setPassengerForms((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const updatePassengerField = (index, field, value) => {
    setPassengerForms((prev) => prev.map((passenger, currentIndex) => currentIndex === index ? { ...passenger, [field]: value } : passenger));
  };

  if (!routeBusId && !routeBus) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/10 p-8 text-center backdrop-blur-xl">
          <h2 className="text-2xl font-semibold text-white">No booking selected</h2>
          <p className="mt-2 text-slate-300">Please select a bus and seats before proceeding to payment.</p>
          <button className="mt-4 rounded-full bg-violet-500 px-5 py-2 font-medium text-white" onClick={() => navigate('/search-bus')}>
            Search Buses
          </button>
        </div>
      </div>
    );
  }

  if (!effectiveTravelDate) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/10 p-8 text-center backdrop-blur-xl">
          <h2 className="text-2xl font-semibold text-white">Travel date is missing</h2>
          <p className="mt-2 text-slate-300">Please select a travel date and seats before proceeding.</p>
          <button className="mt-4 rounded-full bg-violet-500 px-5 py-2 font-medium text-white" onClick={() => navigate('/search-bus')}>
            Search Buses
          </button>
        </div>
      </div>
    );
  }

  if (loadingDetails) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/10 px-8 py-10 text-center backdrop-blur-xl">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-violet-400/30 border-t-violet-400" />
          <p className="text-slate-300">Loading booking details...</p>
        </div>
      </div>
    );
  }

  const handlePayNow = async () => {
    if (!localStorage.getItem('authToken')) {
      navigate('/login');
      return;
    }

    if (!effectiveSelectedSeats || effectiveSelectedSeats.length === 0) {
      setError('Please select a travel date and seat before proceeding.');
      return;
    }

    if (!effectiveTravelDate) {
      setError('Please select a travel date and seat before proceeding.');
      return;
    }

    if (!effectiveBusId) {
      setError('Please select a travel date and seat before proceeding.');
      return;
    }

    if (passengerForms.length !== effectiveSelectedSeats.length) {
      setError(`Passenger count (${passengerForms.length}) must match selected seats (${effectiveSelectedSeats.length})`);
      return;
    }

    const incompletePassenger = passengerForms.findIndex((passenger) => !passenger.name.trim() || !passenger.email.trim() || !passenger.phone.trim());

    if (incompletePassenger >= 0) {
      setError(`Please complete the details for Passenger ${incompletePassenger + 1}.`);
      return;
    }

    if (!guardian.email.trim() || !guardian.phone.trim()) {
      setError('Please provide Guardian Email address and Mobile number for booking safety notifications.');
      return;
    }

    if (!isRazorpayReady || !window.Razorpay) {
      setError('Razorpay checkout is still loading. Please wait a moment and try again.');
      return;
    }

    if (paymentRequestInFlight.current) {
      return;
    }

    paymentRequestInFlight.current = true;
    setError('');
    setIsProcessing(true);

    try {
      const payload = {
        busId: effectiveBusId,
        travelDate: effectiveTravelDate,
        selectedSeats: effectiveSelectedSeats,
        totalAmount: amountPayable,
        passengerDetails: passengerForms.map((passenger) => ({
          name: passenger.name.trim(),
          email: passenger.email.trim(),
          phone: passenger.phone.trim(),
        })),
        safetyContact: {
          name: guardian.name.trim() || 'Parent / Guardian',
          email: guardian.email.trim(),
          phone: guardian.phone.trim(),
          relationship: guardian.relationship.trim() || 'Parent / Guardian',
          notificationPreferences: { email: true, whatsapp: true },
        },
        paymentMode: paymentMethod.toUpperCase(),
      };

      const orderResponse = await api.post('/payments/create-order', payload);
      const { bookingId, order } = orderResponse.data || {};

      if (!order || !order.id || !bookingId) {
        throw new Error('Unable to initialize payment order.');
      }

      const razorpayOptions = {
        key: order.key || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'BusBook',
        description: `Bus ticket for ${effectiveBus?.busName || 'booking'}`,
        order_id: order.id,
        method: paymentMethod === 'scan-pay' ? 'upi' : undefined,
        upi: paymentMethod === 'scan-pay' ? { flow: 'qr' } : undefined,
        handler: async function (response) {
          try {
            const verifyResponse = await api.post('/payments/verify', {
              bookingId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });

            const confirmedBooking = verifyResponse.data?.booking || {};
            const primaryPassenger = confirmedBooking.passengerDetails?.[0] || passengerForms[0] || { name: '', email: '', phone: '' };
            const bookingState = {
              ...confirmedBooking,
              bookingId: confirmedBooking.bookingId || confirmedBooking._id || bookingId,
              passengerName: primaryPassenger.name || passengerForms[0]?.name || '',
              email: primaryPassenger.email || passengerForms[0]?.email || '',
              phone: primaryPassenger.phone || passengerForms[0]?.phone || '',
              paymentMethod: (paymentMethod || 'UPI').toUpperCase().replace('-', ' '),
              totalFare: confirmedBooking.totalAmount || amountPayable,
              busName: effectiveBus?.busName,
              busType: effectiveBus?.busType,
              from: effectiveBus?.from,
              to: effectiveBus?.to,
              journeyDate: effectiveTravelDate,
              departureTime: effectiveBus?.departureTime,
              arrivalTime: effectiveBus?.arrivalTime,
              selectedSeats: effectiveSelectedSeats,
              farePerSeat: effectiveFarePerSeat,
              qrCode: confirmedBooking.qrCode || '',
            };

            const existingBookings = JSON.parse(localStorage.getItem('bookings')) || [];
            const currentBooking = existingBookings.find((entry) => String(entry.bookingId || entry._id) === String(bookingId));
            if (currentBooking) {
              Object.assign(currentBooking, bookingState, { status: 'confirmed' });
            } else {
              existingBookings.push({
                ...bookingState,
                busId: effectiveBusId,
                from: effectiveBus?.from,
                to: effectiveBus?.to,
                seats: effectiveSelectedSeats,
                status: 'confirmed',
                bookingDate: new Date().toISOString(),
              });
            }
            localStorage.setItem('bookings', JSON.stringify(existingBookings));

            setPaymentSuccess(true);
            window.setTimeout(() => {
              navigate('/booking-confirmation', { state: bookingState });
            }, 800);
          } catch (verifyErr) {
            const verifyMessage = verifyErr?.response?.data?.message || 'Payment verification failed. Please try again.';
            setError(verifyMessage);
            setPaymentSuccess(false);
          } finally {
            setIsProcessing(false);
            paymentRequestInFlight.current = false;
          }
        },
        prefill: {
          name: passengerForms[0]?.name?.trim() || '',
          email: passengerForms[0]?.email?.trim() || '',
          contact: passengerForms[0]?.phone?.trim() || '',
        },
        theme: {
          color: '#8b5cf6',
        },
        modal: {
          ondismiss: () => {
            setError('Payment was cancelled. Your booking remains pending.');
            setIsProcessing(false);
            paymentRequestInFlight.current = false;
          },
        },
      };

      const razorpayInstance = new window.Razorpay(razorpayOptions);
      razorpayInstance.open();
    } catch (err) {
      console.error('Payment/booking error:', err);
      const backendMsg = err?.response?.data?.message || '';

      if (backendMsg.toLowerCase().includes('bus') && backendMsg.toLowerCase().includes('required')) {
        setError('Please select a travel date and seat before proceeding.');
      } else if (backendMsg.toLowerCase().includes('seat') && backendMsg.toLowerCase().includes('required')) {
        setError('Please select a travel date and seat before proceeding.');
      } else if (backendMsg.toLowerCase().includes('travel date') && backendMsg.toLowerCase().includes('required')) {
        setError('Please select a travel date and seat before proceeding.');
      } else if (backendMsg.toLowerCase().includes('already booked') || backendMsg.toLowerCase().includes('already taken')) {
        setError('Some selected seats are already booked. Please go back and choose different seats.');
      } else if (backendMsg.toLowerCase().includes('payment')) {
        setError('Payment could not be processed. Please check your payment method and try again.');
      } else if (backendMsg.toLowerCase().includes('network') || backendMsg.toLowerCase().includes('timeout')) {
        setError('Unable to connect. Please check your internet and try again.');
      } else {
        setError(backendMsg || 'Booking could not be completed. Please try again.');
      }
      setIsProcessing(false);
      paymentRequestInFlight.current = false;
    }
  };

  if (paymentSuccess) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[28px] border border-emerald-400/20 bg-emerald-500/10 p-8 text-center backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-white">Payment successful</h2>
          <p className="mt-2 text-slate-300">Your booking is being confirmed and you will be redirected shortly.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="payment-shell">
      <div className="payment-container">
        <header className="payment-header">
          <div>
            <p className="payment-eyebrow">Payment</p>
            <h1 className="payment-page-title">Complete your booking</h1>
            <p className="payment-page-subtitle">Review your journey details and complete payment.</p>
          </div>
          <div className="payment-badge">
            <ShieldCheck size={16} />
            Secure checkout
          </div>
        </header>

        <div className="payment-progress">
          <Stepper steps={['Search', 'Bus', 'Seats', 'Payment', 'Confirmed']} activeStep={3} />
        </div>

        <div className="payment-grid">
          <section className="payment-main-surface">
            <div className="payment-section-block">
              <h2>Passenger details</h2>
              <p>Your ticket updates will be sent using these details.</p>

              {passengerForms.map((passenger, index) => (
                <div key={`${index}-${effectiveSelectedSeats[index] || 'seat'}`} style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ color: '#e2e8f0', fontWeight: 600 }}>
                      Passenger {index + 1}{effectiveSelectedSeats[index] ? ` — Seat ${effectiveSelectedSeats[index]}` : ''}
                    </div>
                    {index > 0 ? (
                      <button
                        type="button"
                        className="payment-coupon-toggle"
                        onClick={() => removePassengerForm(index)}
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>

                  <div className="payment-form-grid">
                    <label className="payment-field">
                      <span>Full name</span>
                      <input value={passenger.name} onChange={(e) => updatePassengerField(index, 'name', e.target.value)} placeholder="Enter full name" />
                    </label>
                    <label className="payment-field">
                      <span>Email address</span>
                      <input type="email" value={passenger.email} onChange={(e) => updatePassengerField(index, 'email', e.target.value)} placeholder="Enter email" />
                    </label>
                    <label className="payment-field payment-field-full">
                      <span>Phone number</span>
                      <input value={passenger.phone} onChange={(e) => updatePassengerField(index, 'phone', e.target.value)} placeholder="Enter phone number" />
                    </label>
                  </div>
                </div>
              ))}

              {passengerForms.length < effectiveSelectedSeats.length ? (
                <button type="button" className="payment-coupon-toggle" onClick={addPassengerForm}>
                  <span>＋</span>
                  <span>Add Passenger</span>
                </button>
              ) : null}
            </div>

            <div className="payment-divider" />

            <div className="payment-section-block">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div>
                  <h2>Guardian / Safety Contact</h2>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>
                    Mandatory safety feature: booking confirmation &amp; boarding updates will be emailed to your guardian.
                  </p>
                </div>
                <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '9999px', background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                  🛡️ Safety Alert
                </span>
              </div>

              <div className="payment-form-grid" style={{ marginTop: '1rem' }}>
                <label className="payment-field">
                  <span>Guardian / Parent Name</span>
                  <input
                    value={guardian.name}
                    onChange={(e) => setGuardian({ ...guardian, name: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                  />
                </label>
                <label className="payment-field">
                  <span>Guardian Email Address *</span>
                  <input
                    type="email"
                    value={guardian.email}
                    onChange={(e) => setGuardian({ ...guardian, email: e.target.value })}
                    placeholder="guardian@example.com"
                    required
                  />
                </label>
                <label className="payment-field">
                  <span>Guardian Mobile Number *</span>
                  <input
                    value={guardian.phone}
                    onChange={(e) => setGuardian({ ...guardian, phone: e.target.value })}
                    placeholder="e.g. 9876543210"
                    required
                  />
                </label>
                <label className="payment-field">
                  <span>Relationship</span>
                  <input
                    value={guardian.relationship}
                    onChange={(e) => setGuardian({ ...guardian, relationship: e.target.value })}
                    placeholder="e.g. Parent, Guardian, Spouse"
                  />
                </label>
              </div>
            </div>

            <div className="payment-divider" />

            <div className="payment-section-block">
              <h2>Payment method</h2>
              <p>Select a payment option to continue.</p>
              <div className="payment-method-grid">
                {paymentOptions.map((method) => (
                  <button key={method.id} type="button" className={`payment-method-option ${paymentMethod === method.id ? 'active' : ''}`} onClick={() => setPaymentMethod(method.id)}>
                    <span className={`payment-method-icon ${paymentMethod === method.id ? 'active' : ''}`}>{method.icon}</span>
                    <span className="payment-method-copy">
                      <span className="payment-method-label">{method.label}</span>
                      <span className="payment-method-description">{method.description}</span>
                    </span>
                    <span className="payment-method-check">{paymentMethod === method.id ? '●' : '○'}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="payment-divider" />

            <div className="payment-section-block">
              <h2>Payment details</h2>
              <p>Use the secure payment option that suits you best.</p>

              {paymentMethod === 'upi' ? (
                <div className="payment-details-box">
                  <label className="payment-field payment-field-full">
                    <span>UPI ID</span>
                    <input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourname@upi" />
                  </label>
                  <p className="payment-help-text">Enter your UPI ID to continue securely.</p>
                </div>
              ) : null}

              {paymentMethod === 'scan-pay' ? (
                <div className="payment-details-box">
                  <div className="text-center">
                    <div className="mb-3 text-lg font-semibold text-white">Scan &amp; Pay</div>
                    <p className="payment-help-text">Razorpay will open the supported UPI QR flow for this booking.</p>
                    <p className="mt-3 text-lg font-semibold text-violet-200">Amount: ₹{amountPayable}</p>
                    <p className="mt-3 text-sm text-slate-300">Scan using Google Pay, PhonePe, Paytm or another supported UPI app from the Razorpay checkout.</p>
                  </div>
                </div>
              ) : null}

              {paymentMethod === 'card' ? (
                <div className="payment-details-box payment-details-grid">
                  <label className="payment-field payment-field-full">
                    <span>Card number</span>
                    <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="0000 0000 0000 0000" />
                  </label>
                  <label className="payment-field">
                    <span>Expiry</span>
                    <input value={expiry} onChange={(e) => setExpiry(e.target.value)} placeholder="MM/YY" />
                  </label>
                  <label className="payment-field">
                    <span>CVV</span>
                    <input value={cvv} onChange={(e) => setCvv(e.target.value)} placeholder="•••" />
                  </label>
                  <label className="payment-field payment-field-full">
                    <span>Name on card</span>
                    <input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Enter cardholder name" />
                  </label>
                </div>
              ) : null}

              {paymentMethod === 'wallet' ? (
                <div className="payment-details-box">
                  <p className="payment-help-text">Your wallet app will be used for the secure payment flow.</p>
                </div>
              ) : null}

              {paymentMethod === 'net-banking' ? (
                <div className="payment-details-box">
                  <p className="payment-help-text">You will be redirected to your bank for the secure payment step.</p>
                </div>
              ) : null}
            </div>

            <div className="payment-divider" />

            <button type="button" className="payment-coupon-toggle" onClick={() => setShowCoupon((value) => !value)}>
              <span>🏷 Have a coupon?</span>
              <span>{showCoupon ? 'Hide' : 'Add coupon'}</span>
            </button>

            {showCoupon ? (
              <div className="payment-coupon-row">
                <input className="payment-input-field" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Enter coupon code" />
                <button type="button">Apply</button>
              </div>
            ) : null}
          </section>

          <aside className="payment-summary-surface">
            <div className="payment-summary-block">
              <p className="payment-summary-label">Booking summary</p>
              <h2>Your journey</h2>

              <div className="payment-route-card">
                <div className="payment-route-stop">
                  <span className="payment-route-time">{displayDeparture}</span>
                  <span className="payment-route-city">{displayFrom}</span>
                </div>
                <div className="payment-route-line-wrap">
                  <span className="payment-route-line" />
                  <span className="payment-route-duration">{effectiveBus?.duration || 'Journey'}</span>
                </div>
                <div className="payment-route-stop payment-route-stop-right">
                  <span className="payment-route-time">{displayArrival}</span>
                  <span className="payment-route-city">{displayTo}</span>
                </div>
              </div>

              <div className="payment-summary-meta">
                <div>
                  <span className="payment-summary-label">Date</span>
                  <p>{effectiveTravelDate}</p>
                </div>
                <div>
                  <span className="payment-summary-label">Seats</span>
                  <p>{effectiveSelectedSeats.join(', ')}</p>
                </div>
                <div>
                  <span className="payment-summary-label">Bus</span>
                  <p>{displayBusType}</p>
                </div>
              </div>
            </div>

            <div className="payment-summary-block payment-summary-block-fare">
              <p className="payment-summary-label">Fare details</p>
              <div className="payment-price-row">
                <span>Fare per seat</span>
                <strong>₹{effectiveFarePerSeat}</strong>
              </div>
              <div className="payment-price-row">
                <span>Seats booked</span>
                <strong>{effectiveSelectedSeats.length}</strong>
              </div>
              <div className="payment-price-row">
                <span>Subtotal</span>
                <strong>₹{effectiveTotalFare}</strong>
              </div>
              <div className="payment-price-row">
                <span>Service fee</span>
                <strong>₹{serviceFee}</strong>
              </div>
              <div className="payment-price-row">
                <span>Taxes</span>
                <strong>₹{taxes}</strong>
              </div>
              <div className="payment-total-row">
                <span>Total</span>
                <strong>₹{amountPayable}</strong>
              </div>
            </div>

            {error ? <div className="payment-error">{error}</div> : null}

            <button className="payment-submit-btn" onClick={handlePayNow} disabled={isProcessing}>
              {isProcessing ? 'Processing payment...' : `Pay ₹${amountPayable} securely`}
            </button>

            <div className="payment-trust-row">
              <span>🔒 Secure payment</span>
              <span>✓ Instant confirmation</span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Payment;