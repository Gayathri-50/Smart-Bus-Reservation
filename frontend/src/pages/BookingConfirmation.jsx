import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const BookingConfirmation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const booking = location.state || {};

  const hasBookingData = Boolean(booking && Object.keys(booking).length > 0);
  const isPaymentFailed = ['PAYMENT_FAILED', 'FAILED', 'payment_failed', 'failed'].includes(booking.paymentStatus || booking.status || '');

  const bookingId = useMemo(() => {
    if (booking.bookingId) return booking.bookingId;
    if (booking._id) return booking._id;
    const now = new Date();
    return `BK${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  }, [booking.bookingId, booking._id]);

  if (!hasBookingData) {
    return (
      <div className="booking-confirmation-page">
        <div className="booking-confirmation-card no-booking-card">
          <div className="confirmation-header">
            <div className="confirmation-icon">⚠️</div>
            <h1>No booking found</h1>
            <p className="confirmation-message">Please complete a seat selection and payment to view confirmation details.</p>
          </div>
          <div className="button-group justify-center">
            <button className="btn-action primary" onClick={() => navigate('/search-bus')}>
              Search Buses
            </button>
          </div>
        </div>
      </div>
    );
  }

  const passengerName =
    booking.passengerName ||
    booking.passengerDetails?.[0]?.name ||
    booking.user?.name ||
    'Passenger';

  const busName = booking.busName || booking.bus?.busName || 'BusBook Express';
  const busType = booking.busType || booking.bus?.busType || 'Standard AC';
  const from = booking.from || booking.bus?.from || 'Origin';
  const to = booking.to || booking.bus?.to || 'Destination';
  const journeyDate = booking.journeyDate || booking.travelDate || booking.bus?.travelDate || '';
  const departureTime = booking.departureTime || booking.bus?.departureTime || 'Scheduled Time';
  const arrivalTime = booking.arrivalTime || booking.bus?.arrivalTime || '';
  const rawSeats = booking.selectedSeats || booking.seats || [];
  const selectedSeats = (Array.isArray(rawSeats) ? rawSeats : [rawSeats]).map(String).filter(Boolean);
  const totalFare = booking.totalFare ?? booking.totalAmount ?? booking.fare ?? 0;
  const farePerSeat = booking.farePerSeat || (selectedSeats.length > 0 ? Math.round(totalFare / selectedSeats.length) : totalFare);
  const paymentMethod = booking.paymentMethod || booking.paymentMode || 'Razorpay / UPI';
  const qrCode = booking.qrCode || '';

  return (
    <div className="booking-confirmation-page">
      <div className="booking-confirmation-card ticket-card">
        <div className="confirmation-header ticket-header">
          <div>
            <div className="confirmation-icon">{isPaymentFailed ? '⚠️' : '✅'}</div>
            <h1>{isPaymentFailed ? 'Payment Failed' : 'Booking Confirmed'}</h1>
          </div>
          <span className="confirmation-tag">{isPaymentFailed ? 'Retry payment' : 'E-ticket delivered'}</span>
        </div>

        <div className="progress-bar">
          <div className="progress-step active" />
          <div className="progress-step active" />
          <div className="progress-step active" />
        </div>

        <div className="ticket-grid">
          <div className="ticket-info">
            <div className="ticket-section">
              <span className="ticket-label">Booking ID</span>
              <p className="ticket-value">{bookingId}</p>
            </div>
            <div className="ticket-section">
              <span className="ticket-label">Passenger</span>
              <p className="ticket-value">{passengerName}</p>
            </div>
            <div className="ticket-section">
              <span className="ticket-label">Route</span>
              <p className="ticket-value">{from} → {to}</p>
            </div>
            <div className="ticket-section">
              <span className="ticket-label">Journey</span>
              <p className="ticket-value">{journeyDate} · {departureTime} - {arrivalTime}</p>
            </div>
            <div className="ticket-section">
              <span className="ticket-label">Seats</span>
              <p className="ticket-value">{selectedSeats.join(', ')}</p>
            </div>
            <div className="ticket-section">
              <span className="ticket-label">Bus</span>
              <p className="ticket-value">{busName} · {busType}</p>
            </div>
            <div className="ticket-section">
              <span className="ticket-label">Payment</span>
              <p className="ticket-value">{paymentMethod}</p>
            </div>
          </div>

          <div className="ticket-qr">
            {isPaymentFailed ? (
              <div className="qr-code-placeholder" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', textAlign: 'center' }}>Payment not completed</div>
            ) : qrCode ? (
              <img src={qrCode} alt="Ticket QR code" style={{ width: '140px', height: '140px', borderRadius: '16px', objectFit: 'cover', background: '#fff', padding: '10px' }} />
            ) : (
              <div className="qr-code-placeholder">QR</div>
            )}
            <div className="fare-summary">
              <div className="fare-row">
                <span>Fare per seat</span>
                <strong>₹{farePerSeat}</strong>
              </div>
              <div className="fare-row total">
                <span>{isPaymentFailed ? 'Amount pending' : 'Total paid'}</span>
                <strong>₹{totalFare}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="ticket-note">
          <p>Show this ticket at boarding. The QR code is valid for one-time entry and ensures a smooth check-in.</p>
        </div>

        <div className="button-group">
          {isPaymentFailed ? (
            <button className="btn-action primary" onClick={() => navigate('/payment', { state: { bus: { busName, busType, from, to, departureTime, arrivalTime, fare: farePerSeat }, busId: booking.busId || booking.bus || '', selectedSeats, travelDate: journeyDate, totalFare, farePerSeat, passengerName, email: booking.email || '', phone: booking.phone || '' } })}>
              Retry Payment
            </button>
          ) : (
            <>
              <button className="btn-action primary" onClick={() => window.print()}>
                Print / Save Ticket
              </button>
              <button className="btn-action secondary" onClick={() => navigate('/booking-history')}>
                View Booking History
              </button>
            </>
          )}
          <button className="btn-action secondary" onClick={() => navigate('/search-bus')}>
            Book Another Trip
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmation;
