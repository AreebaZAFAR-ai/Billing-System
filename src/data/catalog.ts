/**
 * Static fictional reference data used to seed the demo.
 * All names, products and prices are illustrative. No real people, patients or brands.
 */
import type { BusinessProfile, CatalogItem, Department, Industry, Staff } from '@/lib/types';

const rs = (n: number) => Math.round(n * 100);

/** Append an EAN-13 check digit to a 12-digit base. */
function ean13(base12: string): string {
  const sum = base12.split('').reduce((a, d, i) => a + Number(d) * (i % 2 ? 3 : 1), 0);
  return base12 + String((10 - (sum % 10)) % 10);
}

type P = [name: string, category: string, price: number, cost: number, unit: string, stock: number, reorder: number];

const groceryRaw: P[] = [
  ['Basmati Rice 5 kg', 'Staples', 2450, 2150, 'bag', 34, 10],
  ['Sella Rice 5 kg', 'Staples', 2100, 1840, 'bag', 22, 10],
  ['Wheat Flour (Atta) 10 kg', 'Staples', 1350, 1210, 'bag', 41, 15],
  ['White Sugar 1 kg', 'Staples', 165, 148, 'pack', 120, 40],
  ['Chana Daal 1 kg', 'Staples', 340, 295, 'pack', 48, 20],
  ['Masoor Daal 1 kg', 'Staples', 380, 330, 'pack', 9, 20],
  ['Iodized Salt 800 g', 'Staples', 60, 48, 'pack', 85, 25],
  ['Red Chilli Powder 200 g', 'Staples', 260, 215, 'pack', 37, 15],
  ['Sunflower Cooking Oil 5 L', 'Oil & Ghee', 2750, 2480, 'tin', 18, 8],
  ['Canola Oil 3 L', 'Oil & Ghee', 1790, 1600, 'bottle', 6, 8],
  ['Banaspati Ghee 1 kg', 'Oil & Ghee', 560, 500, 'pack', 52, 15],
  ['Fresh Milk 1 L', 'Dairy & Eggs', 230, 205, 'pack', 64, 30],
  ['UHT Milk 1 L', 'Dairy & Eggs', 290, 258, 'pack', 96, 30],
  ['Plain Yogurt 1 kg', 'Dairy & Eggs', 260, 225, 'tub', 14, 12],
  ['Salted Butter 200 g', 'Dairy & Eggs', 520, 455, 'pack', 26, 10],
  ['Cheddar Cheese Slices 200 g', 'Dairy & Eggs', 690, 600, 'pack', 4, 6],
  ['Farm Eggs (Dozen)', 'Dairy & Eggs', 360, 318, 'tray', 45, 20],
  ['Sandwich Bread Large', 'Bakery', 190, 160, 'loaf', 28, 15],
  ['Whole Wheat Bread', 'Bakery', 220, 185, 'loaf', 11, 12],
  ['Tea Rusk 300 g', 'Bakery', 250, 210, 'pack', 33, 10],
  ['Cola 1.5 L', 'Beverages', 220, 188, 'bottle', 72, 24],
  ['Mineral Water 1.5 L', 'Beverages', 90, 70, 'bottle', 140, 48],
  ['Mango Juice 1 L', 'Beverages', 330, 285, 'pack', 39, 12],
  ['Black Tea 950 g', 'Beverages', 1650, 1480, 'pack', 21, 8],
  ['Instant Coffee 100 g', 'Beverages', 1150, 990, 'jar', 7, 6],
  ['Green Tea (30 bags)', 'Beverages', 380, 320, 'box', 19, 8],
  ['Salted Potato Chips', 'Snacks', 150, 118, 'pack', 88, 24],
  ['Cream Biscuits', 'Snacks', 60, 47, 'pack', 130, 40],
  ['Spicy Nimko 200 g', 'Snacks', 180, 145, 'pack', 3, 10],
  ['Laundry Detergent 1 kg', 'Household', 690, 600, 'pack', 31, 10],
  ['Dishwash Bar', 'Household', 105, 86, 'bar', 64, 20],
  ['Dishwash Liquid 500 ml', 'Household', 380, 325, 'bottle', 17, 8],
  ['Toilet Tissue (4 rolls)', 'Household', 520, 445, 'pack', 23, 10],
  ['Floor Cleaner 1 L', 'Household', 450, 380, 'bottle', 12, 8],
  ['Bath Soap', 'Personal Care', 145, 118, 'bar', 76, 24],
  ['Herbal Shampoo 360 ml', 'Personal Care', 850, 735, 'bottle', 15, 8],
  ['Toothpaste 150 g', 'Personal Care', 320, 270, 'tube', 42, 15],
];

export const groceryCatalog: CatalogItem[] = groceryRaw.map(([name, category, price, cost, unit, stock, reorder], i) => ({
  id: `gp_${i + 1}`,
  kind: 'product',
  name,
  category,
  price: rs(price),
  cost: rs(cost),
  unit,
  sku: `GR-${1001 + i}`,
  // 200–299 prefix is reserved for in-store codes, so these never collide with real product barcodes.
  barcode: ean13(`20000000${1001 + i}`),
  trackStock: true,
  stock,
  reorderLevel: reorder,
  active: true,
}));

type S = [name: string, category: string, price: number, cost: number, durationMin?: number];

const clinicRaw: S[] = [
  ['General Consultation', 'Consultation', 2000, 0, 15],
  ['Follow-up Consultation', 'Consultation', 1200, 0, 10],
  ['Specialist Consultation', 'Consultation', 3500, 0, 20],
  ['Pediatric Consultation', 'Consultation', 2500, 0, 20],
  ['Wound Dressing', 'Procedure', 800, 180, 15],
  ['Injection Administration', 'Procedure', 300, 60, 5],
  ['Nebulization', 'Procedure', 600, 120, 15],
  ['ECG (12-lead)', 'Procedure', 1500, 250, 15],
  ['Minor Suturing', 'Procedure', 3000, 600, 30],
  ['Ear Wash', 'Procedure', 1200, 150, 15],
  ['Complete Blood Count (CBC)', 'Laboratory', 1200, 420, 0],
  ['Fasting Blood Sugar', 'Laboratory', 350, 110, 0],
  ['HbA1c', 'Laboratory', 2200, 900, 0],
  ['Lipid Profile', 'Laboratory', 2800, 1100, 0],
  ['Liver Function Test (LFT)', 'Laboratory', 2400, 950, 0],
  ['Thyroid (TSH)', 'Laboratory', 1800, 700, 0],
  ['Urine Routine Exam', 'Laboratory', 500, 140, 0],
  ['Vitamin D', 'Laboratory', 3500, 1500, 0],
];

export const clinicCatalog: CatalogItem[] = clinicRaw.map(([name, category, price, cost, durationMin], i) => ({
  id: `cs_${i + 1}`,
  kind: 'service',
  name,
  category,
  price: rs(price),
  cost: rs(cost),
  sku: `CL-${201 + i}`,
  durationMin,
  trackStock: false,
  active: true,
}));

export const hospitalDepartments: Department[] = [
  { id: 'dep_gm', name: 'General Medicine', code: 'GM' },
  { id: 'dep_ped', name: 'Pediatrics', code: 'PED' },
  { id: 'dep_car', name: 'Cardiology', code: 'CAR' },
  { id: 'dep_sur', name: 'General Surgery', code: 'SUR' },
  { id: 'dep_er', name: 'Emergency', code: 'ER' },
  { id: 'dep_lab', name: 'Laboratory', code: 'LAB' },
  { id: 'dep_rad', name: 'Radiology', code: 'RAD' },
  { id: 'dep_phr', name: 'Pharmacy', code: 'PHR' },
];

type H = [name: string, category: string, dept: string, price: number, cost: number, stock?: number, reorder?: number];

const hospitalRaw: H[] = [
  ['OPD Consultation — General Medicine', 'Consultation', 'dep_gm', 2500, 0],
  ['OPD Consultation — Pediatrics', 'Consultation', 'dep_ped', 3000, 0],
  ['OPD Consultation — Cardiology', 'Consultation', 'dep_car', 4500, 0],
  ['OPD Consultation — Surgery', 'Consultation', 'dep_sur', 4000, 0],
  ['Emergency Assessment', 'Consultation', 'dep_er', 3500, 0],
  ['Inpatient Doctor Visit (per day)', 'Consultation', 'dep_gm', 3000, 0],
  ['Nursing Care (per day)', 'Procedure', 'dep_gm', 3500, 1200],
  ['Complete Blood Count (CBC)', 'Laboratory', 'dep_lab', 1400, 480],
  ['Renal Function Test (RFT)', 'Laboratory', 'dep_lab', 2600, 950],
  ['Liver Function Test (LFT)', 'Laboratory', 'dep_lab', 2800, 1000],
  ['Lipid Profile', 'Laboratory', 'dep_lab', 3000, 1150],
  ['Troponin I', 'Laboratory', 'dep_lab', 4500, 1900],
  ['Blood Culture', 'Laboratory', 'dep_lab', 5200, 2100],
  ['X-Ray Chest (PA view)', 'Radiology', 'dep_rad', 1800, 500],
  ['Ultrasound Abdomen', 'Radiology', 'dep_rad', 4000, 900],
  ['CT Scan Brain (plain)', 'Radiology', 'dep_rad', 14000, 4200],
  ['MRI Knee', 'Radiology', 'dep_rad', 26000, 8500],
  ['ECG (12-lead)', 'Procedure', 'dep_car', 1200, 200],
  ['Echocardiography', 'Procedure', 'dep_car', 7500, 1500],
  ['Minor Surgical Procedure', 'Procedure', 'dep_sur', 25000, 7000],
  ['Appendectomy (package)', 'Procedure', 'dep_sur', 185000, 70000],
  ['Diagnostic Angiography', 'Procedure', 'dep_car', 85000, 32000],
  ['IV Saline 500 ml', 'Pharmacy', 'dep_phr', 260, 190, 340, 100],
  ['Paracetamol 500 mg (10 tabs)', 'Pharmacy', 'dep_phr', 60, 38, 620, 150],
  ['Amoxicillin 500 mg (10 caps)', 'Pharmacy', 'dep_phr', 320, 240, 180, 80],
  ['Omeprazole 20 mg (14 caps)', 'Pharmacy', 'dep_phr', 380, 280, 64, 80],
  ['Ceftriaxone 1 g Injection', 'Pharmacy', 'dep_phr', 650, 480, 140, 60],
  ['IV Cannula', 'Pharmacy', 'dep_phr', 220, 140, 35, 60],
  ['Disposable Syringe 5 ml', 'Pharmacy', 'dep_phr', 30, 18, 900, 200],
];

export const hospitalCatalog: CatalogItem[] = hospitalRaw.map(([name, category, dept, price, cost, stock, reorder], i) => ({
  id: `hs_${i + 1}`,
  kind: category === 'Pharmacy' ? 'product' : 'service',
  name,
  category,
  departmentId: dept,
  price: rs(price),
  cost: rs(cost),
  sku: `HS-${301 + i}`,
  trackStock: category === 'Pharmacy',
  stock,
  reorderLevel: reorder,
  unit: category === 'Pharmacy' ? 'unit' : undefined,
  active: true,
}));

export const ROOM_TYPES: { name: string; rate: number }[] = [
  { name: 'General Ward', rate: rs(6000) },
  { name: 'Semi-private Room', rate: rs(12000) },
  { name: 'Private Room', rate: rs(20000) },
  { name: 'ICU', rate: rs(45000) },
];

const salonRaw: [name: string, category: string, price: number, cost: number, durationMin: number][] = [
  ["Women's Haircut & Style", 'Hair', 2500, 250, 45],
  ["Men's Haircut", 'Hair', 1200, 100, 30],
  ['Blow-dry', 'Hair', 1800, 150, 30],
  ['Global Hair Color', 'Hair', 9500, 2600, 120],
  ['Highlights', 'Hair', 14000, 3800, 150],
  ['Keratin Treatment', 'Hair Treatment', 22000, 6500, 180],
  ['Hair Spa Treatment', 'Hair Treatment', 5500, 1200, 60],
  ['Classic Facial', 'Skin', 4500, 900, 60],
  ['Hydra Facial', 'Skin', 9000, 2200, 75],
  ['Gold Facial', 'Skin', 6500, 1600, 70],
  ['Manicure', 'Nails', 2200, 350, 40],
  ['Pedicure', 'Nails', 2800, 450, 50],
  ['Gel Nail Extensions', 'Nails', 4000, 900, 60],
  ['Eyebrow Threading', 'Waxing & Threading', 300, 20, 10],
  ['Full-face Wax', 'Waxing & Threading', 1800, 250, 25],
  ['Party Makeup', 'Makeup', 9000, 1800, 75],
  ['Bridal Makeup', 'Makeup', 65000, 12000, 180],
  ['Mehndi (both hands)', 'Makeup', 3500, 400, 60],
];

export const salonCatalog: CatalogItem[] = [
  ...salonRaw.map(([name, category, price, cost, durationMin], i): CatalogItem => ({
    id: `ss_${i + 1}`,
    kind: 'service',
    name,
    category,
    price: rs(price),
    cost: rs(cost),
    sku: `SL-${401 + i}`,
    durationMin,
    trackStock: false,
    active: true,
  })),
  {
    id: 'sk_1',
    kind: 'package',
    name: 'Pamper Day Package',
    category: 'Packages',
    price: rs(8500),
    cost: rs(1700),
    sku: 'PK-501',
    durationMin: 150,
    includes: ['Classic Facial', 'Manicure', 'Pedicure'],
    trackStock: false,
    active: true,
  },
  {
    id: 'sk_2',
    kind: 'package',
    name: 'Bridal Glow Package',
    category: 'Packages',
    price: rs(18000),
    cost: rs(4200),
    sku: 'PK-502',
    durationMin: 240,
    includes: ['Hydra Facial', 'Hair Spa Treatment', 'Manicure', 'Pedicure'],
    trackStock: false,
    active: true,
  },
  {
    id: 'sk_3',
    kind: 'package',
    name: 'Groom Grooming Package',
    category: 'Packages',
    price: rs(12000),
    cost: rs(2600),
    sku: 'PK-503',
    durationMin: 180,
    includes: ["Men's Haircut", 'Gold Facial', 'Manicure', 'Pedicure'],
    trackStock: false,
    active: true,
  },
  ...(
    [
      ['Argan Hair Serum 100 ml', 2400, 1650, 14, 5],
      ['Sulfate-free Shampoo 300 ml', 2900, 2000, 9, 5],
      ['Repair Hair Mask 250 ml', 2600, 1800, 3, 4],
      ['Sunscreen SPF 50', 1950, 1300, 22, 6],
      ['Nail Polish', 650, 380, 41, 10],
      ['Gentle Face Wash', 1100, 720, 6, 6],
    ] as [string, number, number, number, number][]
  ).map(([name, price, cost, stock, reorder], i): CatalogItem => ({
    id: `sr_${i + 1}`,
    kind: 'product',
    name,
    category: 'Retail Products',
    price: rs(price),
    cost: rs(cost),
    sku: `SR-${601 + i}`,
    unit: 'unit',
    trackStock: true,
    stock,
    reorderLevel: reorder,
    active: true,
  })),
];

export const staffSeed: Record<Industry, Staff[]> = {
  grocery: [
    { id: 'st_g1', industry: 'grocery', name: 'Usman Tariq', role: 'Store Manager', active: true },
    { id: 'st_g2', industry: 'grocery', name: 'Nida Akhtar', role: 'Cashier', active: true },
    { id: 'st_g3', industry: 'grocery', name: 'Bilal Hussain', role: 'Cashier', active: true },
  ],
  clinic: [
    { id: 'dr_c1', industry: 'clinic', name: 'Dr. Sana Malik', role: 'Doctor', specialty: 'General Physician', consultationFee: rs(2000), active: true },
    { id: 'dr_c2', industry: 'clinic', name: 'Dr. Imran Qureshi', role: 'Doctor', specialty: 'Pediatrician', consultationFee: rs(2500), active: true },
    { id: 'dr_c3', industry: 'clinic', name: 'Dr. Hira Siddiqui', role: 'Doctor', specialty: 'Dermatologist', consultationFee: rs(3500), active: true },
    { id: 'dr_c4', industry: 'clinic', name: 'Dr. Faisal Raza', role: 'Doctor', specialty: 'Family Medicine', consultationFee: rs(2000), active: true },
    { id: 'st_c5', industry: 'clinic', name: 'Amna Javed', role: 'Front Desk', active: true },
  ],
  hospital: [
    { id: 'dr_h1', industry: 'hospital', name: 'Dr. Tariq Mehmood', role: 'Consultant', departmentId: 'dep_gm', specialty: 'Internal Medicine', active: true },
    { id: 'dr_h2', industry: 'hospital', name: 'Dr. Maryam Abbasi', role: 'Consultant', departmentId: 'dep_ped', specialty: 'Pediatrics', active: true },
    { id: 'dr_h3', industry: 'hospital', name: 'Dr. Kashif Mirza', role: 'Consultant', departmentId: 'dep_car', specialty: 'Cardiology', active: true },
    { id: 'dr_h4', industry: 'hospital', name: 'Dr. Rabia Sheikh', role: 'Consultant', departmentId: 'dep_sur', specialty: 'General Surgery', active: true },
    { id: 'dr_h5', industry: 'hospital', name: 'Dr. Omar Chaudhry', role: 'Medical Officer', departmentId: 'dep_er', specialty: 'Emergency Medicine', active: true },
    { id: 'dr_h6', industry: 'hospital', name: 'Dr. Saadia Iqbal', role: 'Consultant', departmentId: 'dep_rad', specialty: 'Radiology', active: true },
    { id: 'dr_h7', industry: 'hospital', name: 'Dr. Zubair Khan', role: 'Consultant', departmentId: 'dep_gm', specialty: 'Pulmonology', active: true },
  ],
  salon: [
    { id: 'st_s1', industry: 'salon', name: 'Mahnoor Butt', role: 'Senior Stylist', commissionRate: 15, active: true },
    { id: 'st_s2', industry: 'salon', name: 'Ayesha Raza', role: 'Stylist', commissionRate: 12, active: true },
    { id: 'st_s3', industry: 'salon', name: 'Kiran Shah', role: 'Beautician', commissionRate: 10, active: true },
    { id: 'st_s4', industry: 'salon', name: 'Zainab Ali', role: 'Makeup Artist', commissionRate: 20, active: true },
    { id: 'st_s5', industry: 'salon', name: 'Sadia Noor', role: 'Nail Technician', commissionRate: 10, active: true },
    { id: 'st_s6', industry: 'salon', name: 'Hamza Saleem', role: "Men's Stylist", commissionRate: 12, active: true },
  ],
};

export const defaultBusinesses: Record<Industry, BusinessProfile> = {
  grocery: {
    name: 'FreshCart Mart',
    phone: '',
    email: '',
    address: '',
    logoText: 'FC',
    invoicePrefix: 'GRC',
    taxRate: 18,
    taxLabel: 'Sales tax',
    taxEnabled: false,
    paymentTermsDays: 0,
    footerNote: 'Thank you for shopping with us.',
    paymentInstructions: 'Goods once sold can be exchanged within 7 days with receipt.',
  },
  clinic: {
    name: 'CarePoint Family Clinic',
    phone: '',
    email: '',
    address: '',
    logoText: 'CP',
    invoicePrefix: 'CLN',
    taxRate: 0,
    taxLabel: 'Tax',
    taxEnabled: false,
    paymentTermsDays: 7,
    footerNote: 'Wishing you good health.',
    paymentInstructions: 'Outstanding balances can be settled at the front desk.',
  },
  hospital: {
    name: 'Meridian General Hospital',
    phone: '',
    email: '',
    address: '',
    logoText: 'MG',
    invoicePrefix: 'HSP',
    taxRate: 0,
    taxLabel: 'Tax',
    taxEnabled: false,
    paymentTermsDays: 15,
    footerNote: 'This is a computer-generated bill.',
    paymentInstructions: 'Please clear outstanding balances at the billing counter before the due date.',
  },
  salon: {
    name: 'Luxe & Lather Salon',
    phone: '',
    email: '',
    address: '',
    logoText: 'LL',
    invoicePrefix: 'SLN',
    taxRate: 5,
    taxLabel: 'Sales tax',
    taxEnabled: true,
    paymentTermsDays: 0,
    footerNote: 'We look forward to seeing you again.',
    paymentInstructions: '',
  },
};

export const FIRST_F = ['Ayesha', 'Fatima', 'Zainab', 'Hira', 'Sana', 'Mahnoor', 'Iqra', 'Amna', 'Maryam', 'Nida', 'Rabia', 'Sadia', 'Kiran', 'Anum', 'Mehwish', 'Alina', 'Areeba', 'Hafsa', 'Laiba', 'Saba'];
export const FIRST_M = ['Ahmed', 'Ali', 'Hamza', 'Usman', 'Bilal', 'Faisal', 'Imran', 'Kashif', 'Saad', 'Zubair', 'Tariq', 'Omar', 'Hassan', 'Danish', 'Waqas', 'Arslan', 'Fahad', 'Junaid', 'Shahzad', 'Rehan'];
export const LAST = ['Khan', 'Ahmed', 'Malik', 'Qureshi', 'Siddiqui', 'Sheikh', 'Butt', 'Chaudhry', 'Raza', 'Hussain', 'Javed', 'Abbasi', 'Mirza', 'Akhtar', 'Iqbal', 'Hashmi', 'Rana', 'Baig'];
export const CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan'];
