const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const Bus = require('../src/models/Bus');

const sampleBuses = [
  {
    busName: 'KSRTC Airavat Club Class',
    operator: 'Karnataka State Road Transport',
    busType: 'AC Sleeper',
    from: 'Bangalore',
    to: 'Chennai',
    fromCity: 'Bangalore',
    toCity: 'Chennai',
    departureTime: '21:30',
    arrivalTime: '05:30',
    duration: '8h 00m',
    totalSeats: 40,
    availableSeats: 38,
    emergencySeats: 2,
    fare: 850,
    rating: 4.8,
    reviews: 142,
    amenities: ['AC', 'Charging Point', 'Blankets', 'Water Bottle', 'Reading Light', 'WiFi'],
    boardingPoint: { name: 'Majestic Bus Terminal', address: 'Platform 3, Majestic, Bangalore', time: '21:30' },
    droppingPoint: { name: 'Koyambedu CMBT', address: 'CMBT Terminal, Koyambedu, Chennai', time: '05:30' },
    routeCities: ['Bangalore', 'Hosur', 'Vellore', 'Kanchipuram', 'Chennai'],
    cancellationPolicy: 'Free cancellation up to 6 hours before departure.',
    bookedSeats: [1, 2],
  },
  {
    busName: 'Orange Travels Platinum',
    operator: 'Orange Tour and Travels',
    busType: 'AC Sleeper',
    from: 'Bangalore',
    to: 'Hyderabad',
    fromCity: 'Bangalore',
    toCity: 'Hyderabad',
    departureTime: '22:00',
    arrivalTime: '06:30',
    duration: '8h 30m',
    totalSeats: 40,
    availableSeats: 36,
    emergencySeats: 2,
    fare: 1100,
    rating: 4.7,
    reviews: 210,
    amenities: ['AC', 'Live Tracking', 'Blankets', 'Snacks', 'WiFi'],
    boardingPoint: { name: 'Madiwala', address: 'Near Petrol Bunk, Madiwala, Bangalore', time: '22:00' },
    droppingPoint: { name: 'Ameerpet', address: 'Near Metro Station, Ameerpet, Hyderabad', time: '06:30' },
    routeCities: ['Bangalore', 'Anantapur', 'Kurnool', 'Hyderabad'],
    cancellationPolicy: '50% refund between 6 and 2 hours before trip.',
    bookedSeats: [3, 4, 5, 6],
  },
  {
    busName: 'Shivneri Super AC Express',
    operator: 'MSRTC Intercity',
    busType: 'AC Seater',
    from: 'Mumbai',
    to: 'Pune',
    fromCity: 'Mumbai',
    toCity: 'Pune',
    departureTime: '07:00',
    arrivalTime: '10:30',
    duration: '3h 30m',
    totalSeats: 40,
    availableSeats: 40,
    emergencySeats: 2,
    fare: 450,
    rating: 4.6,
    reviews: 95,
    amenities: ['AC', 'Water Bottle', 'Charging Point'],
    boardingPoint: { name: 'Dadar Asiad Bus Stand', address: 'Dadar East, Mumbai', time: '07:00' },
    droppingPoint: { name: 'Swargate', address: 'Swargate Bus Stand, Pune', time: '10:30' },
    routeCities: ['Mumbai', 'Navi Mumbai', 'Lonavala', 'Pune'],
    cancellationPolicy: 'Instant full refund upon cancellation 4 hours before journey.',
    bookedSeats: [],
  },
  {
    busName: 'Neeta Volvo Multi-Axle',
    operator: 'Neeta Tours & Travels',
    busType: 'AC Sleeper',
    from: 'Mumbai',
    to: 'Pune',
    fromCity: 'Mumbai',
    toCity: 'Pune',
    departureTime: '17:30',
    arrivalTime: '21:00',
    duration: '3h 30m',
    totalSeats: 40,
    availableSeats: 38,
    emergencySeats: 2,
    fare: 550,
    rating: 4.5,
    reviews: 80,
    amenities: ['AC', 'Reading Light', 'Charging Point', 'Emergency Hammer'],
    boardingPoint: { name: 'Borivali West', address: 'Near Gokul Hotel, Borivali, Mumbai', time: '17:30' },
    droppingPoint: { name: 'Shivajinagar', address: 'Wakdewadi, Shivajinagar, Pune', time: '21:00' },
    routeCities: ['Mumbai', 'Thane', 'Vashi', 'Pune'],
    cancellationPolicy: 'Refund processed within 24 hours of cancellation.',
    bookedSeats: [7, 8],
  },
  {
    busName: 'RSRTC Goldline Express',
    operator: 'Rajasthan State Road Transport',
    busType: 'AC Seater',
    from: 'Delhi',
    to: 'Jaipur',
    fromCity: 'Delhi',
    toCity: 'Jaipur',
    departureTime: '06:00',
    arrivalTime: '11:00',
    duration: '5h 00m',
    totalSeats: 40,
    availableSeats: 40,
    emergencySeats: 2,
    fare: 500,
    rating: 4.5,
    reviews: 130,
    amenities: ['AC', 'Water Bottle', 'First Aid Box'],
    boardingPoint: { name: 'ISBT Kashmiri Gate', address: 'Gate 4, Kashmiri Gate, Delhi', time: '06:00' },
    droppingPoint: { name: 'Sindhi Camp', address: 'Main Terminal, Sindhi Camp, Jaipur', time: '11:00' },
    routeCities: ['Delhi', 'Gurgaon', 'Kotputli', 'Jaipur'],
    cancellationPolicy: 'Standard government transport cancellation rules apply.',
    bookedSeats: [],
  },
  {
    busName: 'Zingbus Electric Intercity',
    operator: 'Zing Mobility Pvt Ltd',
    busType: 'AC Seater',
    from: 'Delhi',
    to: 'Jaipur',
    fromCity: 'Delhi',
    toCity: 'Jaipur',
    departureTime: '14:00',
    arrivalTime: '19:00',
    duration: '5h 00m',
    totalSeats: 40,
    availableSeats: 35,
    emergencySeats: 2,
    fare: 620,
    rating: 4.9,
    reviews: 320,
    amenities: ['AC', 'High Speed WiFi', 'Charging Point', 'Live Tracking', 'Clean Restrooms'],
    boardingPoint: { name: 'Dhaula Kuan', address: 'Metro Pillar 82, Dhaula Kuan, Delhi', time: '14:00' },
    droppingPoint: { name: 'Narayan Singh Circle', address: 'Near Police Memorial, Jaipur', time: '19:00' },
    routeCities: ['Delhi', 'Manesar', 'Shahpura', 'Jaipur'],
    cancellationPolicy: 'Zero cancellation fee up to 2 hours before departure.',
    bookedSeats: [9, 10, 11, 12, 13],
  },
  {
    busName: 'SRS Sleeper Express',
    operator: 'SRS Travels',
    busType: 'Non-AC Sleeper',
    from: 'Chennai',
    to: 'Coimbatore',
    fromCity: 'Chennai',
    toCity: 'Coimbatore',
    departureTime: '21:00',
    arrivalTime: '06:00',
    duration: '9h 00m',
    totalSeats: 40,
    availableSeats: 40,
    emergencySeats: 2,
    fare: 700,
    rating: 4.3,
    reviews: 64,
    amenities: ['Blankets', 'Reading Light', 'Charging Point'],
    boardingPoint: { name: 'Koyambedu', address: 'Omni Bus Stand, Koyambedu, Chennai', time: '21:00' },
    droppingPoint: { name: 'Gandhipuram', address: 'Central Bus Stand, Gandhipuram, Coimbatore', time: '06:00' },
    routeCities: ['Chennai', 'Salem', 'Erode', 'Tiruppur', 'Coimbatore'],
    cancellationPolicy: 'Cancel up to 12 hours prior for 80% refund.',
    bookedSeats: [],
  },
  {
    busName: 'Morning Star Super Luxury',
    operator: 'Morning Star Travels',
    busType: 'AC Sleeper',
    from: 'Hyderabad',
    to: 'Vijayawada',
    fromCity: 'Hyderabad',
    toCity: 'Vijayawada',
    departureTime: '23:00',
    arrivalTime: '04:30',
    duration: '5h 30m',
    totalSeats: 40,
    availableSeats: 39,
    emergencySeats: 2,
    fare: 650,
    rating: 4.6,
    reviews: 112,
    amenities: ['AC', 'Blankets', 'Water Bottle', 'Charging Point'],
    boardingPoint: { name: 'MGBS Hyderabad', address: 'Platform 18, MGBS, Hyderabad', time: '23:00' },
    droppingPoint: { name: 'PNBS Vijayawada', address: 'Pandit Nehru Bus Station, Vijayawada', time: '04:30' },
    routeCities: ['Hyderabad', 'Suryapet', 'Nandigama', 'Vijayawada'],
    cancellationPolicy: 'Free cancellation up to 4 hours before departure.',
    bookedSeats: [15],
  },
  {
    busName: 'Kadamba Coastal Cruiser',
    operator: 'Kadamba Transport Corp',
    busType: 'AC Sleeper',
    from: 'Pune',
    to: 'Goa',
    fromCity: 'Pune',
    toCity: 'Goa',
    departureTime: '20:30',
    arrivalTime: '06:30',
    duration: '10h 00m',
    totalSeats: 40,
    availableSeats: 38,
    emergencySeats: 2,
    fare: 950,
    rating: 4.7,
    reviews: 180,
    amenities: ['AC', 'Blankets', 'Charging Point', 'Emergency Kit'],
    boardingPoint: { name: 'Katraj Wonder City', address: 'Katraj Bypass, Pune', time: '20:30' },
    droppingPoint: { name: 'Panaji KTC Bus Stand', address: 'Panaji Central, Goa', time: '06:30' },
    routeCities: ['Pune', 'Satara', 'Kolhapur', 'Belgaum', 'Goa'],
    cancellationPolicy: 'Full refund if cancelled 8 hours prior.',
    bookedSeats: [19, 20],
  },
];

async function seedBuses() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/busbooking';

  console.log('====================================================');
  console.log('🚌 Smart Bus Reservation — Bus Inventory Seeder');
  console.log('====================================================');
  console.log(`Connecting to MongoDB at ${mongoUri}...`);

  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.');

    let createdCount = 0;
    let updatedCount = 0;

    for (const busData of sampleBuses) {
      const query = {
        busName: busData.busName,
        from: busData.from,
        to: busData.to,
        departureTime: busData.departureTime,
      };

      const existing = await Bus.findOne(query);

      if (existing) {
        // Update existing bus without wiping out booked seats if users booked it
        await Bus.updateOne(query, {
          $set: {
            operator: busData.operator,
            busType: busData.busType,
            duration: busData.duration,
            fare: busData.fare,
            amenities: busData.amenities,
            boardingPoint: busData.boardingPoint,
            droppingPoint: busData.droppingPoint,
            routeCities: busData.routeCities,
          },
        });
        updatedCount++;
      } else {
        await Bus.create(busData);
        createdCount++;
      }
    }

    const totalCount = await Bus.countDocuments();

    console.log('\n🎉 SUCCESS! Bus inventory seed complete.');
    console.log(`✨ Newly created: ${createdCount} buses`);
    console.log(`🔄 Updated/Verified: ${updatedCount} buses`);
    console.log(`📊 Total buses in database: ${totalCount}`);
    console.log('====================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Seeding failed:', err.message);
    process.exit(1);
  }
}

seedBuses();
