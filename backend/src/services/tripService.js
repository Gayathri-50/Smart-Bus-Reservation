const Trip = require('../models/Trip');
const Bus = require('../models/Bus');

/**
 * Format Date to YYYY-MM-DD in local/server timezone
 */
const formatDateString = (dateObj) => {
  const d = new Date(dateObj);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Retrieve existing Trip or initialize inventory for the specified bus and travel date
 */
const getOrCreateTrip = async ({ busId, travelDate }) => {
  let trip = await Trip.findOne({ bus: busId, travelDate }).populate('bus');

  if (!trip) {
    const bus = await Bus.findById(busId);
    if (!bus) throw new Error('Bus not found');

    trip = await Trip.create({
      bus: bus._id,
      busName: bus.busName,
      from: bus.from,
      to: bus.to,
      travelDate,
      departureTime: bus.departureTime || '08:00',
      arrivalTime: bus.arrivalTime || '16:00',
      fare: bus.fare || 500,
      totalSeats: bus.totalSeats || 40,
      emergencySeats: [39, 40],
      bookedSeats: [],
      emergencyBookedSeats: [],
      status: 'SCHEDULED',
    });
  }

  return trip;
};

/**
 * Check if today is the day before (or same day) of the trip for Emergency Booking
 * Rule: Emergency booking opens ONLY the day before the trip.
 */
const checkEmergencyBookingEligibility = (travelDateStr) => {
  const todayStr = formatDateString(new Date());

  const today = new Date(todayStr);
  const travelDate = new Date(travelDateStr);

  // Time difference in days
  const diffTime = travelDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Eligible if travel is today or within next 3 days
  if (diffDays >= 0 && diffDays <= 3) {
    return { eligible: true, message: 'Emergency booking window is OPEN.' };
  }

  if (diffDays > 3) {
    return {
      eligible: false,
      message: 'Emergency booking is only open for travel today and within the next 3 days.',
    };
  }

  return { eligible: false, message: 'Trip has already passed.' };
};

/**
 * Atomic seat reservation with race-condition protection
 */
const atomicReserveSeats = async ({ tripId, seats, isEmergency = false }) => {
  const numericSeats = seats.map((s) => Number(s));

  if (isEmergency) {
    if (numericSeats.length > 2) {
      throw new Error('Maximum 2 emergency seats can be booked per request.');
    }

    // Atomic conditional update ensuring seats are not already in bookedSeats
    const trip = await Trip.findOneAndUpdate(
      {
        _id: tripId,
        bookedSeats: { $nin: numericSeats },
      },
      {
        $addToSet: {
          bookedSeats: { $each: numericSeats },
          emergencyBookedSeats: { $each: numericSeats },
        },
      },
      { new: true }
    );

    if (!trip) {
      throw new Error('Selected emergency seats are already booked or no longer available.');
    }

    return trip;
  }

  // Normal Booking
  // Normal bookings cannot reserve emergency seats (39, 40)
  const containsEmergencySeat = numericSeats.some((s) => s === 39 || s === 40);
  if (containsEmergencySeat) {
    throw new Error('Seats 39 and 40 are reserved for Emergency Bookings.');
  }

  const trip = await Trip.findOneAndUpdate(
    {
      _id: tripId,
      bookedSeats: { $nin: numericSeats },
    },
    {
      $addToSet: { bookedSeats: { $each: numericSeats } },
    },
    { new: true }
  );

  if (!trip) {
    throw new Error('One or more selected seats were just booked by another user. Please pick different seats.');
  }

  return trip;
};

/**
 * Release seats upon cancellation
 */
const releaseSeats = async ({ tripId, seats }) => {
  const numericSeats = seats.map((s) => Number(s));
  return await Trip.findByIdAndUpdate(
    tripId,
    {
      $pull: {
        bookedSeats: { $in: numericSeats },
        emergencyBookedSeats: { $in: numericSeats },
      },
    },
    { new: true }
  );
};

module.exports = {
  formatDateString,
  getOrCreateTrip,
  checkEmergencyBookingEligibility,
  atomicReserveSeats,
  releaseSeats,
};
