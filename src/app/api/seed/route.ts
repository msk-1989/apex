import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hash } from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now()

    // Delete new module tables first (reverse dependency order)
    await db.delivery.deleteMany()
    await db.claim.deleteMany()
    await db.commission.deleteMany()
    await db.notification.deleteMany()
    await db.auditLog.deleteMany()
    await db.prescription.deleteMany()
    await db.rateContractItem.deleteMany()
    await db.rateContract.deleteMany()
    await db.scheme.deleteMany()
    await db.unitConversion.deleteMany()
    await db.mrpHistory.deleteMany()

    // Delete existing data in reverse dependency order
    await db.payment.deleteMany()
    await db.salesInvoiceItem.deleteMany()
    await db.salesInvoice.deleteMany()
    await db.stockAdjustment.deleteMany()
    await db.purchaseOrderItem.deleteMany()
    await db.purchaseOrder.deleteMany()
    await db.dayBook.deleteMany()
    await db.medicineBatch.deleteMany()
    await db.medicine.deleteMany()
    await db.customer.deleteMany()
    await db.counter.deleteMany()
    await db.staff.deleteMany()
    await db.expense.deleteMany()
    await db.supplier.deleteMany()
    await db.manufacturer.deleteMany()
    await db.category.deleteMany()

    // ============ CATEGORIES ============
    const categoryNames = [
      { name: 'Tablets', description: 'Oral solid dosage tablets' },
      { name: 'Capsules', description: 'Oral solid dosage capsules' },
      { name: 'Syrups', description: 'Liquid oral formulations' },
      { name: 'Injections', description: 'Parenteral dosage forms' },
      { name: 'Creams/Ointments', description: 'Topical preparations' },
      { name: 'Eye/Ear Drops', description: 'Ophthalmic and otic solutions' },
      { name: 'Inhalers', description: 'Respiratory inhalation products' },
      { name: 'Powders', description: 'Powder formulations' },
      { name: 'Vitamins/Supplements', description: 'Nutritional supplements' },
      { name: 'Ayurvedic', description: 'Traditional Ayurvedic medicines' },
      { name: 'Surgical', description: 'Surgical supplies and disposables' },
      { name: 'Personal Care', description: 'Personal hygiene and care products' },
    ]
    const categories = await Promise.all(
      categoryNames.map(c => db.category.create({ data: c }))
    )
    const cat = Object.fromEntries(categories.map(c => [c.name, c.id]))

    // ============ MANUFACTURERS ============
    const mfrNames = [
      { name: 'Cipla', address: 'Mumbai Central, Mumbai', phone: '022-24801000', email: 'info@cipla.com', gstNo: '27AABCC7030Q1ZG' },
      { name: 'Sun Pharma', address: 'Andheri East, Mumbai', phone: '022-27402900', email: 'info@sunpharma.com', gstNo: '27AABCS8190K1ZB' },
      { name: "Dr. Reddy's", address: 'Hyderabad, Telangana', phone: '040-49002400', email: 'info@drreddys.com', gstNo: '36AABCD1234Q1Z1' },
      { name: 'Lupin', address: 'Lupin Tower, Mumbai', phone: '022-68036500', email: 'info@lupin.com', gstNo: '27AABCL5080M1Z3' },
      { name: 'Aurobindo', address: 'Hyderabad, Telangana', phone: '040-30405060', email: 'info@aurobindo.com', gstNo: '36AABCA5678P1Z2' },
      { name: 'Glenmark', address: 'Andheri West, Mumbai', phone: '022-67289000', email: 'info@glenmark.com', gstNo: '27AABCG9012R1Z4' },
      { name: 'Zydus', address: 'Sarkhej, Ahmedabad', phone: '079-26881234', email: 'info@zydus.com', gstNo: '24AABCZ3456S1Z5' },
      { name: 'Abbott', address: 'Mumbai, Maharashtra', phone: '022-40063000', email: 'info@abbott.com', gstNo: '27AABCA7890T1Z6' },
      { name: 'Mankind', address: 'New Delhi', phone: '011-46001234', email: 'info@mankind.com', gstNo: '07AABCM2345U1Z7' },
      { name: 'Dabur', address: 'Kaushambi, Ghaziabad', phone: '0120-4043900', email: 'info@dabur.com', gstNo: '09AABCD6789V1Z8' },
      { name: 'Himalaya', address: 'Makali, Bangalore', phone: '080-23711111', email: 'info@himalaya.com', gstNo: '29AABCH0123W1Z9' },
    ]
    const manufacturers = await Promise.all(
      mfrNames.map(m => db.manufacturer.create({ data: m }))
    )
    const mfr = Object.fromEntries(manufacturers.map(m => [m.name, m.id]))

    // ============ SUPPLIERS ============
    const supplierData = [
      { name: 'MediCorp Distributors', contactPerson: 'Rajesh Kumar', address: 'Plot 45, Industrial Area, Phase II, Chandigarh', phone: '9876543210', email: 'rajesh@medicorp.com', gstNo: '04AABCM9876X1Z1', dlNo: 'DL-CHD-2024-001', balance: 25000 },
      { name: 'Pharma Supply Chain', contactPerson: 'Anita Sharma', address: 'Warehouse 12, Transport Nagar, Delhi', phone: '9876543211', email: 'anita@pharmasupply.com', gstNo: '07AABCP5432Y1Z2', dlNo: 'DL-DEL-2024-015', balance: 15000 },
      { name: 'HealthCare Wholesalers', contactPerson: 'Vikram Singh', address: 'Block B, Medical Market, Ludhiana', phone: '9876543212', email: 'vikram@hcwholesale.com', gstNo: '03AABCH1234Z1Z3', dlNo: 'DL-LDH-2024-008', balance: 38000 },
      { name: 'National Drug House', contactPerson: 'Priya Mehta', address: 'Sector 18, Noida, UP', phone: '9876543213', email: 'priya@nationaldrug.com', gstNo: '09AABCN6543A1Z4', dlNo: 'DL-NOD-2024-022', balance: 5000 },
      { name: 'Regional Pharma Traders', contactPerson: 'Suresh Patel', address: 'MG Road, Ahmedabad, Gujarat', phone: '9876543214', email: 'suresh@regionalpharma.com', gstNo: '24AABCR9876B1Z5', dlNo: 'DL-AHD-2024-011', balance: 42000 },
    ]
    const suppliers = await Promise.all(
      supplierData.map(s => db.supplier.create({ data: s }))
    )
    const sup = Object.fromEntries(suppliers.map(s => [s.name, s.id]))

    // ============ STAFF ============
    const staffData = [
      { name: 'Admin User', email: 'admin@pharmacy.com', phone: '9999999001', role: 'admin', password: await hash('admin123', 10) },
      { name: 'Dr. Meera Patel', email: 'meera@pharmacy.com', phone: '9999999002', role: 'pharmacist', password: await hash('pharm123', 10) },
      { name: 'Rahul Verma', email: 'rahul@pharmacy.com', phone: '9999999003', role: 'salesman', password: await hash('sales123', 10) },
    ]
    const staffList = await Promise.all(
      staffData.map(s => db.staff.create({ data: s }))
    )
    const staff = Object.fromEntries(staffList.map(s => [s.name, s.id]))

    // ============ COUNTERS ============
    const counters = await Promise.all([
      db.counter.create({ data: { name: 'Counter A', code: 'CTR-A' } }),
      db.counter.create({ data: { name: 'Counter B', code: 'CTR-B' } }),
      db.counter.create({ data: { name: 'Counter C', code: 'CTR-C' } }),
    ])
    const ctr = Object.fromEntries(counters.map(c => [c.name, c.id]))

    // ============ MEDICINES ============
    // Helper: shorthand for medicine creation
    const M = (name: string, genericName: string, salt: string, category: string, manufacturer: string, hsn: string, schedule: string, strength: string, form: string, unit: string, stripQty: number, gst: number, minStock: number, maxStock: number, rack: string) => ({
      name, genericName, saltComposition: salt, categoryId: cat[category], manufacturerId: mfr[manufacturer], hsnCode: hsn, schedule, strength, form, unit, stripQty, gstRate: gst, minStockLevel: minStock, maxStockLevel: maxStock, rackNo: rack,
    })

    const medsInput = [
      M('Paracetamol 500mg', 'Paracetamol', 'Paracetamol 500mg', 'Tablets', 'Cipla', '30049099', 'none', '500mg', 'tablet', 'strip', 10, 5, 50, 500, 'A1-01'),
      M('Crocin Advance', 'Paracetamol', 'Paracetamol 500mg', 'Tablets', 'Mankind', '30049099', 'none', '500mg', 'tablet', 'strip', 15, 5, 30, 300, 'A1-02'),
      M('Dolo 650', 'Paracetamol', 'Paracetamol 650mg', 'Tablets', 'Mankind', '30049099', 'none', '650mg', 'tablet', 'strip', 15, 5, 50, 500, 'A1-03'),
      M('Amoxicillin 250mg', 'Amoxicillin', 'Amoxicillin 250mg', 'Capsules', 'Cipla', '30041099', 'H', '250mg', 'capsule', 'strip', 10, 5, 30, 300, 'A2-01'),
      M('Azithromycin 500mg', 'Azithromycin', 'Azithromycin 500mg', 'Tablets', 'Cipla', '30041099', 'H', '500mg', 'tablet', 'strip', 3, 5, 20, 200, 'A2-02'),
      M('Combiflam', 'Ibuprofen+Paracetamol', 'Ibuprofen 400mg + Paracetamol 325mg', 'Tablets', 'Abbott', '30049099', 'none', '400mg+325mg', 'tablet', 'strip', 20, 5, 30, 300, 'A1-04'),
      M('Metformin 500mg', 'Metformin', 'Metformin Hydrochloride 500mg', 'Tablets', 'Aurobindo', '30049099', 'H', '500mg', 'tablet', 'strip', 10, 5, 50, 500, 'B1-01'),
      M('Atorvastatin 10mg', 'Atorvastatin', 'Atorvastatin Calcium 10mg', 'Tablets', 'Zydus', '30049099', 'H', '10mg', 'tablet', 'strip', 10, 5, 30, 300, 'B1-02'),
      M('Omeprazole 20mg', 'Omeprazole', 'Omeprazole 20mg', 'Capsules', 'Cipla', '30049099', 'H', '20mg', 'capsule', 'strip', 15, 5, 30, 300, 'B1-03'),
      M('Vitamin D3 60K IU', 'Cholecalciferol', 'Cholecalciferol 60000 IU', 'Vitamins/Supplements', 'Abbott', '30045000', 'none', '60000 IU', 'capsule', 'pack', 4, 5, 20, 200, 'C1-01'),
      M('Shelcal 500mg', 'Calcium+Vitamin D3', 'Calcium 500mg + Vitamin D3 250 IU', 'Vitamins/Supplements', 'Abbott', '30045000', 'none', '500mg', 'tablet', 'bottle', 30, 5, 15, 150, 'C1-02'),
      M('Autrin', 'Iron+Folic Acid', 'Ferrous Fumarate 300mg + Folic Acid 1.5mg', 'Vitamins/Supplements', 'Zydus', '30045000', 'none', '300mg', 'tablet', 'strip', 10, 5, 20, 200, 'C1-03'),
      M('Benadryl Cough Syrup', 'Diphenhydramine', 'Diphenhydramine HCl 14.4mg per 5ml', 'Syrups', 'Abbott', '30049099', 'H', '100ml', 'syrup', 'bottle', 1, 5, 15, 100, 'D1-01'),
      M('Honitus Syrup', 'Honey+Tulsi', 'Honey 4.5g + Tulsi per 10ml', 'Syrups', 'Dabur', '30049099', 'none', '100ml', 'syrup', 'bottle', 1, 5, 15, 100, 'D1-02'),
      M('Refresh Tears', 'Carboxymethylcellulose', 'CMC Sodium 0.5% w/v', 'Eye/Ear Drops', 'Sun Pharma', '30049099', 'none', '0.5%', 'drops', 'bottle', 1, 5, 20, 150, 'E1-01'),
      M('Ciplox Eye Drops', 'Ciprofloxacin', 'Ciprofloxacin HCl 0.3% w/v', 'Eye/Ear Drops', 'Cipla', '30049099', 'H', '0.3%', 'drops', 'bottle', 1, 5, 15, 100, 'E1-02'),
      M('Betadine Ointment', 'Povidone Iodine', 'Povidone Iodine 5% w/w', 'Creams/Ointments', 'Sun Pharma', '30049099', 'none', '5%', 'cream', 'tube', 1, 5, 20, 150, 'F1-01'),
      M('Candid Cream', 'Clotrimazole', 'Clotrimazole 1% w/w', 'Creams/Ointments', 'Glenmark', '30049099', 'none', '1%', 'cream', 'tube', 1, 5, 20, 150, 'F1-02'),
      M('Moov Cream', 'Diclofenac+Menthol', 'Diclofenac 1.16% + Methyl Salicylate 10%', 'Creams/Ointments', 'Dabur', '30049099', 'none', '50g', 'cream', 'tube', 1, 12, 15, 100, 'F1-03'),
      M('Duonase Nasal Spray', 'Fluticasone+Azelastine', 'Fluticasone 50mcg + Azelastine 140mcg', 'Inhalers', 'Sun Pharma', '30049099', 'H', '50mcg', 'inhaler', 'bottle', 1, 5, 10, 80, 'G1-01'),
      M('Seroflo Inhaler 250', 'Fluticasone+Salmeterol', 'Fluticasone 250mcg + Salmeterol 50mcg', 'Inhalers', 'Cipla', '30049099', 'H', '250mcg', 'inhaler', 'piece', 1, 5, 10, 80, 'G1-02'),
      M('ORS Powder', 'Oral Rehydration Salts', 'NaCl 2.6g + KCl 1.5g + NaCitrate 2.9g + Glucose 13.5g', 'Powders', 'Cipla', '30049099', 'none', '21.8g', 'powder', 'piece', 1, 5, 30, 200, 'H1-01'),
      M('Shahi Balm', 'Camphor+Menthol', 'Camphor + Menthol + Eucalyptus Oil', 'Ayurvedic', 'Dabur', '30049099', 'none', '50g', 'cream', 'tube', 1, 12, 15, 100, 'I1-01'),
      M('Ashwagandha Churna', 'Withania Somnifera', 'Ashwagandha Root Powder', 'Ayurvedic', 'Himalaya', '30049099', 'none', '200g', 'powder', 'pack', 1, 5, 15, 100, 'I1-02'),
      M('Chyawanprash', 'Amla+Multiple Herbs', 'Amla enriched with 40+ Ayurvedic herbs', 'Ayurvedic', 'Dabur', '30049099', 'none', '500g', 'syrup', 'bottle', 1, 5, 10, 80, 'I1-03'),
      M('Glycomet GP 2', 'Metformin+Glimepiride', 'Metformin 500mg + Glimepiride 2mg', 'Tablets', 'Aurobindo', '30049099', 'H', '500mg+2mg', 'tablet', 'strip', 10, 5, 30, 300, 'B1-04'),
      M('Amlip 5mg', 'Amlodipine', 'Amlodipine Besylate 5mg', 'Tablets', 'Cipla', '30049099', 'H', '5mg', 'tablet', 'strip', 14, 5, 30, 300, 'B1-05'),
      M('Telma 40', 'Telmisartan', 'Telmisartan 40mg', 'Tablets', 'Glenmark', '30049099', 'H', '40mg', 'tablet', 'strip', 10, 5, 30, 300, 'B1-06'),
      M('Pantoprazole 40mg', 'Pantoprazole', 'Pantoprazole Sodium 40mg', 'Tablets', 'Lupin', '30049099', 'H', '40mg', 'tablet', 'strip', 10, 5, 30, 300, 'B1-07'),
      M('Montair LC', 'Montelukast+Levocetirizine', 'Montelukast 10mg + Levocetirizine 5mg', 'Tablets', 'Cipla', '30049099', 'H', '10mg+5mg', 'tablet', 'strip', 10, 5, 25, 250, 'A2-03'),
      M('Becosules', 'Vitamin B Complex', 'B1+B2+B6+B12+Niacinamide+Folic Acid+Vit C', 'Vitamins/Supplements', 'Abbott', '30045000', 'none', 'Complex', 'capsule', 'strip', 20, 5, 40, 400, 'C1-04'),
      M('Surgicare Face Mask', 'Surgical Mask', '3-Ply Surgical Face Mask', 'Surgical', 'Aurobindo', '63079090', 'none', 'N/A', 'tablet', 'pack', 50, 5, 20, 200, 'J1-01'),
      M('Dettol Handwash', 'Chloroxylenol', 'Chloroxylenol 4.8% w/v', 'Personal Care', 'Dabur', '34013090', 'none', '200ml', 'syrup', 'bottle', 1, 12, 20, 150, 'K1-01'),
      M('Cetirizine 10mg', 'Cetirizine', 'Cetirizine Hydrochloride 10mg', 'Tablets', 'Dr. Reddy\'s', '30049099', 'none', '10mg', 'tablet', 'strip', 10, 5, 40, 400, 'A1-05'),
      M('Pan-D Capsule', 'Pantoprazole+Domperidone', 'Pantoprazole 40mg + Domperidone 30mg', 'Capsules', 'Aurobindo', '30049099', 'H', '40mg+30mg', 'capsule', 'strip', 15, 5, 30, 300, 'B1-08'),
    ]

    const medicines = []
    for (const medData of medsInput) {
      const med = await db.medicine.create({ data: medData })
      medicines.push(med)
    }
    const medMap = Object.fromEntries(medicines.map(m => [m.name, m]))

    // ============ MEDICINE BATCHES ============
    const today = new Date()

    type BatchDef = { batchNo: string; expiryMonths: number; costPrice: number; mrp: number; stock: number }
    const batchDefs: Record<string, BatchDef[]> = {
      'Paracetamol 500mg': [
        { batchNo: 'B2024001', expiryMonths: 24, costPrice: 8, mrp: 18.5, stock: 200 },
        { batchNo: 'B2024002', expiryMonths: 3, costPrice: 8.5, mrp: 18.5, stock: 50 },
      ],
      'Crocin Advance': [
        { batchNo: 'B2024042', expiryMonths: 18, costPrice: 22, mrp: 50, stock: 100 },
      ],
      'Dolo 650': [
        { batchNo: 'B2024003', expiryMonths: 18, costPrice: 18, mrp: 42, stock: 300 },
        { batchNo: 'B2024004', expiryMonths: 6, costPrice: 19, mrp: 42, stock: 80 },
      ],
      'Amoxicillin 250mg': [
        { batchNo: 'B2024007', expiryMonths: 18, costPrice: 35, mrp: 78, stock: 100 },
      ],
      'Azithromycin 500mg': [
        { batchNo: 'B2024008', expiryMonths: 24, costPrice: 45, mrp: 105, stock: 80 },
        { batchNo: 'B2024009', expiryMonths: 8, costPrice: 46, mrp: 105, stock: 40 },
      ],
      'Combiflam': [
        { batchNo: 'B2024005', expiryMonths: 20, costPrice: 22, mrp: 48, stock: 150 },
        { batchNo: 'B2024006', expiryMonths: 4, costPrice: 23, mrp: 48, stock: 30 },
      ],
      'Metformin 500mg': [
        { batchNo: 'B2024010', expiryMonths: 24, costPrice: 12, mrp: 28, stock: 250 },
        { batchNo: 'B2024011', expiryMonths: 12, costPrice: 13, mrp: 28, stock: 100 },
      ],
      'Atorvastatin 10mg': [
        { batchNo: 'B2024012', expiryMonths: 24, costPrice: 30, mrp: 68, stock: 120 },
      ],
      'Omeprazole 20mg': [
        { batchNo: 'B2024013', expiryMonths: 18, costPrice: 22, mrp: 52, stock: 150 },
        { batchNo: 'B2024014', expiryMonths: 2, costPrice: 23, mrp: 52, stock: 20 },
      ],
      'Vitamin D3 60K IU': [
        { batchNo: 'B2024015', expiryMonths: 30, costPrice: 28, mrp: 65, stock: 60 },
      ],
      'Shelcal 500mg': [
        { batchNo: 'B2024016', expiryMonths: 24, costPrice: 85, mrp: 178, stock: 40 },
      ],
      'Autrin': [
        { batchNo: 'B2024017', expiryMonths: 18, costPrice: 18, mrp: 42, stock: 80 },
      ],
      'Benadryl Cough Syrup': [
        { batchNo: 'B2024018', expiryMonths: 12, costPrice: 55, mrp: 120, stock: 40 },
      ],
      'Honitus Syrup': [
        { batchNo: 'B2024019', expiryMonths: 18, costPrice: 60, mrp: 135, stock: 35 },
      ],
      'Refresh Tears': [
        { batchNo: 'B2024020', expiryMonths: 12, costPrice: 85, mrp: 198, stock: 50 },
        { batchNo: 'B2024021', expiryMonths: 2, costPrice: 88, mrp: 198, stock: 15 },
      ],
      'Ciplox Eye Drops': [
        { batchNo: 'B2024022', expiryMonths: 12, costPrice: 18, mrp: 42, stock: 45 },
      ],
      'Betadine Ointment': [
        { batchNo: 'B2024023', expiryMonths: 24, costPrice: 38, mrp: 85, stock: 60 },
      ],
      'Candid Cream': [
        { batchNo: 'B2024024', expiryMonths: 24, costPrice: 48, mrp: 108, stock: 55 },
      ],
      'Moov Cream': [
        { batchNo: 'B2024025', expiryMonths: 24, costPrice: 42, mrp: 95, stock: 50 },
      ],
      'Duonase Nasal Spray': [
        { batchNo: 'B2024026', expiryMonths: 18, costPrice: 180, mrp: 410, stock: 25 },
      ],
      'Seroflo Inhaler 250': [
        { batchNo: 'B2024027', expiryMonths: 18, costPrice: 195, mrp: 445, stock: 20 },
        { batchNo: 'B2024028', expiryMonths: 5, costPrice: 200, mrp: 445, stock: 8 },
      ],
      'ORS Powder': [
        { batchNo: 'B2024029', expiryMonths: 24, costPrice: 14, mrp: 33, stock: 150 },
      ],
      'Shahi Balm': [
        { batchNo: 'B2024030', expiryMonths: 24, costPrice: 32, mrp: 75, stock: 40 },
      ],
      'Ashwagandha Churna': [
        { batchNo: 'B2024031', expiryMonths: 24, costPrice: 85, mrp: 195, stock: 30 },
      ],
      'Chyawanprash': [
        { batchNo: 'B2024032', expiryMonths: 18, costPrice: 155, mrp: 325, stock: 25 },
      ],
      'Glycomet GP 2': [
        { batchNo: 'B2024033', expiryMonths: 18, costPrice: 55, mrp: 125, stock: 80 },
      ],
      'Amlip 5mg': [
        { batchNo: 'B2024034', expiryMonths: 24, costPrice: 25, mrp: 58, stock: 100 },
      ],
      'Telma 40': [
        { batchNo: 'B2024035', expiryMonths: 24, costPrice: 55, mrp: 125, stock: 90 },
      ],
      'Pantoprazole 40mg': [
        { batchNo: 'B2024036', expiryMonths: 18, costPrice: 28, mrp: 65, stock: 110 },
      ],
      'Montair LC': [
        { batchNo: 'B2024037', expiryMonths: 18, costPrice: 75, mrp: 168, stock: 70 },
      ],
      'Becosules': [
        { batchNo: 'B2024038', expiryMonths: 18, costPrice: 18, mrp: 42, stock: 200 },
        { batchNo: 'B2024039', expiryMonths: 6, costPrice: 19, mrp: 42, stock: 60 },
      ],
      'Surgicare Face Mask': [
        { batchNo: 'B2024040', expiryMonths: 36, costPrice: 35, mrp: 75, stock: 80 },
      ],
      'Dettol Handwash': [
        { batchNo: 'B2024041', expiryMonths: 36, costPrice: 65, mrp: 140, stock: 60 },
      ],
      'Cetirizine 10mg': [
        { batchNo: 'B2024043', expiryMonths: 20, costPrice: 15, mrp: 35, stock: 180 },
      ],
      'Pan-D Capsule': [
        { batchNo: 'B2024044', expiryMonths: 18, costPrice: 42, mrp: 95, stock: 100 },
      ],
    }

    // Map: batchId -> { medicineId, batchNo, currentStock, mrp, costPrice, sellingPrice, wholesalePrice }
    const batchInfo: Record<string, { medicineId: string; batchNo: string; currentStock: number; mrp: number; costPrice: number; sellingPrice: number; wholesalePrice: number }> = {}

    for (const med of medicines) {
      const defs = batchDefs[med.name]
      if (!defs) continue
      for (const def of defs) {
        const expiryDate = new Date(today)
        expiryDate.setMonth(expiryDate.getMonth() + def.expiryMonths)
        const mfgDate = new Date(expiryDate)
        mfgDate.setFullYear(mfgDate.getFullYear() - 2)
        const sellingPrice = Math.round(def.mrp * 0.95 * 100) / 100
        const wholesalePrice = Math.round(def.mrp * 0.88 * 100) / 100
        const batch = await db.medicineBatch.create({
          data: {
            medicineId: med.id,
            batchNo: def.batchNo,
            expiryDate,
            manufacturingDate: mfgDate,
            costPrice: def.costPrice,
            mrp: def.mrp,
            sellingPrice,
            wholesalePrice,
            openingStock: def.stock,
            currentStock: def.stock,
          },
        })
        batchInfo[batch.id] = { medicineId: med.id, batchNo: batch.batchNo, currentStock: batch.currentStock, mrp: batch.mrp, costPrice: batch.costPrice, sellingPrice, wholesalePrice }
      }
    }

    // Helper: find first available batch for a medicine name
    function findBatch(medName: string) {
      const med = medMap[medName]
      if (!med) return null
      const entry = Object.entries(batchInfo).find(([, v]) => v.medicineId === med.id && v.currentStock > 0)
      if (!entry) return null
      return { med, batchId: entry[0], info: entry[1] }
    }

    // ============ CUSTOMERS ============
    const customers = await Promise.all([
      db.customer.create({ data: { name: 'Ramesh Gupta', phone: '9812345001', address: '45, Sector 15, Chandigarh', type: 'retail', loyaltyPts: 250 } }),
      db.customer.create({ data: { name: 'Sunita Devi', phone: '9812345002', address: '12, Model Town, Ludhiana', type: 'retail', loyaltyPts: 180 } }),
      db.customer.create({ data: { name: 'Dr. A.K. Singh Clinic', phone: '9812345003', address: 'MG Road Clinic, Amritsar', email: 'dr.singh@clinic.com', gstNo: '03AABCS5678Q1Z1', dlNo: 'DL-AMR-2024-001', type: 'institutional', creditLimit: 50000, balance: 8500 } }),
      db.customer.create({ data: { name: 'City Medical Store', phone: '9812345004', address: 'SCO 56, Sector 22, Chandigarh', email: 'citymedical@store.com', gstNo: '04AABCM1234R1Z2', dlNo: 'DL-CHD-2024-002', type: 'wholesale', creditLimit: 100000, balance: 22000 } }),
      db.customer.create({ data: { name: 'Priya Sharma', phone: '9812345005', address: 'House 78, Phase 7, Mohali', type: 'retail', loyaltyPts: 90 } }),
      db.customer.create({ data: { name: 'Arun Kumar', phone: '9812345006', address: '33, Shastri Nagar, Jalandhar', type: 'retail', loyaltyPts: 320 } }),
      db.customer.create({ data: { name: 'Meena Hospital', phone: '9812345007', address: 'GT Road, Ambala Cantt', email: 'pharmacy@meenahospital.com', gstNo: '06AABCH7890S1Z3', dlNo: 'DL-AMB-2024-003', type: 'institutional', creditLimit: 200000, balance: 45000 } }),
      db.customer.create({ data: { name: 'Vijay Health Center', phone: '9812345008', address: 'Main Bazaar, Patiala', email: 'info@vijayhealth.com', gstNo: '03AABCJ2345T1Z4', dlNo: 'DL-PAT-2024-004', type: 'wholesale', creditLimit: 75000, balance: 12000 } }),
      db.customer.create({ data: { name: 'Kavita Joshi', phone: '9812345009', address: 'Flat 201, Sunny Enclave, Kharar', type: 'retail', loyaltyPts: 45 } }),
      db.customer.create({ data: { name: 'Harpreet Singh', phone: '9812345010', address: 'Village Road, Kurali', type: 'retail', loyaltyPts: 60 } }),
      db.customer.create({ data: { name: 'Sanjeevani Nursing Home', phone: '9812345011', address: 'Civil Lines, Hoshiarpur', email: 'store@sanjeevani.com', gstNo: '03AABCK6789U1Z5', dlNo: 'DL-HOS-2024-005', type: 'institutional', creditLimit: 150000, balance: 28000 } }),
      db.customer.create({ data: { name: 'Deepak Chemist', phone: '9812345012', address: 'Mandi, Gobindgarh', email: 'deepak@chemist.com', gstNo: '03AABCL0123V1Z6', dlNo: 'DL-GBG-2024-006', type: 'wholesale', creditLimit: 50000, balance: 5500 } }),
    ])

    // ============ PURCHASE ORDERS ============
    let poCounter = 1
    function poNo() { return `PO-2024-${String(poCounter++).padStart(4, '0')}` }

    type POItem = { medicineName: string; batchNo: string; costPrice: number; mrp: number; quantity: number; gstRate: number }
    type PODef = { supplierName: string; daysAgo: number; status: string; paymentStatus: string; paymentMode: string; createdBy: string; items: POItem[] }

    const poDefs: PODef[] = [
      { supplierName: 'MediCorp Distributors', daysAgo: 30, status: 'received', paymentStatus: 'paid', paymentMode: 'bank_transfer', createdBy: 'Admin User', items: [
        { medicineName: 'Paracetamol 500mg', batchNo: 'B2024001', costPrice: 8, mrp: 18.5, quantity: 200, gstRate: 5 },
        { medicineName: 'Dolo 650', batchNo: 'B2024003', costPrice: 18, mrp: 42, quantity: 300, gstRate: 5 },
        { medicineName: 'Combiflam', batchNo: 'B2024005', costPrice: 22, mrp: 48, quantity: 150, gstRate: 5 },
        { medicineName: 'Amoxicillin 250mg', batchNo: 'B2024007', costPrice: 35, mrp: 78, quantity: 100, gstRate: 5 },
      ]},
      { supplierName: 'Pharma Supply Chain', daysAgo: 20, status: 'received', paymentStatus: 'partial', paymentMode: 'bank_transfer', createdBy: 'Admin User', items: [
        { medicineName: 'Omeprazole 20mg', batchNo: 'B2024013', costPrice: 22, mrp: 52, quantity: 150, gstRate: 5 },
        { medicineName: 'Atorvastatin 10mg', batchNo: 'B2024012', costPrice: 30, mrp: 68, quantity: 120, gstRate: 5 },
        { medicineName: 'Metformin 500mg', batchNo: 'B2024010', costPrice: 12, mrp: 28, quantity: 250, gstRate: 5 },
        { medicineName: 'Becosules', batchNo: 'B2024038', costPrice: 18, mrp: 42, quantity: 200, gstRate: 5 },
      ]},
      { supplierName: 'HealthCare Wholesalers', daysAgo: 15, status: 'received', paymentStatus: 'unpaid', paymentMode: 'bank_transfer', createdBy: 'Admin User', items: [
        { medicineName: 'Seroflo Inhaler 250', batchNo: 'B2024027', costPrice: 195, mrp: 445, quantity: 20, gstRate: 5 },
        { medicineName: 'Duonase Nasal Spray', batchNo: 'B2024026', costPrice: 180, mrp: 410, quantity: 25, gstRate: 5 },
        { medicineName: 'Montair LC', batchNo: 'B2024037', costPrice: 75, mrp: 168, quantity: 70, gstRate: 5 },
      ]},
      { supplierName: 'National Drug House', daysAgo: 10, status: 'received', paymentStatus: 'paid', paymentMode: 'upi', createdBy: 'Dr. Meera Patel', items: [
        { medicineName: 'Vitamin D3 60K IU', batchNo: 'B2024015', costPrice: 28, mrp: 65, quantity: 60, gstRate: 5 },
        { medicineName: 'Shelcal 500mg', batchNo: 'B2024016', costPrice: 85, mrp: 178, quantity: 40, gstRate: 5 },
        { medicineName: 'Autrin', batchNo: 'B2024017', costPrice: 18, mrp: 42, quantity: 80, gstRate: 5 },
      ]},
      { supplierName: 'Regional Pharma Traders', daysAgo: 5, status: 'received', paymentStatus: 'unpaid', paymentMode: 'bank_transfer', createdBy: 'Dr. Meera Patel', items: [
        { medicineName: 'Chyawanprash', batchNo: 'B2024032', costPrice: 155, mrp: 325, quantity: 25, gstRate: 5 },
        { medicineName: 'Ashwagandha Churna', batchNo: 'B2024031', costPrice: 85, mrp: 195, quantity: 30, gstRate: 5 },
        { medicineName: 'Surgicare Face Mask', batchNo: 'B2024040', costPrice: 35, mrp: 75, quantity: 80, gstRate: 5 },
        { medicineName: 'Dettol Handwash', batchNo: 'B2024041', costPrice: 65, mrp: 140, quantity: 60, gstRate: 12 },
      ]},
    ]

    for (const poDef of poDefs) {
      const subtotal = poDef.items.reduce((s, i) => s + i.costPrice * i.quantity, 0)
      const gstAmount = poDef.items.reduce((s, i) => s + Math.round(i.costPrice * i.quantity * i.gstRate / 100 * 100) / 100, 0)
      const totalAmount = subtotal + gstAmount
      const paidAmount = poDef.paymentStatus === 'paid' ? totalAmount : poDef.paymentStatus === 'partial' ? totalAmount * 0.5 : 0

      await db.purchaseOrder.create({
        data: {
          invoiceNo: poNo(),
          supplierId: sup[poDef.supplierName],
          date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - poDef.daysAgo),
          subtotal, gstAmount, totalAmount, paidAmount,
          status: poDef.status,
          paymentStatus: poDef.paymentStatus,
          paymentMode: poDef.paymentMode,
          createdBy: staff[poDef.createdBy],
          items: {
            create: poDef.items.map(i => ({
              medicineId: medMap[i.medicineName]!.id,
              batchNo: i.batchNo,
              gstRate: i.gstRate,
              costPrice: i.costPrice,
              mrp: i.mrp,
              quantity: i.quantity,
              receivedQty: i.quantity,
              gstAmount: Math.round(i.costPrice * i.quantity * i.gstRate / 100 * 100) / 100,
              totalAmount: Math.round(i.costPrice * i.quantity * (1 + i.gstRate / 100) * 100) / 100,
            })),
          },
        },
      })
    }

    // ============ SALES INVOICES ============
    let invCounter = 1
    function invNo() { return `INV-2024-${String(invCounter++).padStart(5, '0')}` }

    type SaleItemDef = { medicineName: string; quantity: number }
    type SaleDef = { customerIdx: number; counterName: string; type: string; daysAgo: number; hoursOffset: number; paymentMode: string; items: SaleItemDef[]; doctorName?: string; prescriptionNo?: string }

    const saleDefs: SaleDef[] = [
      // Today's sales
      { customerIdx: -1, counterName: 'Counter A', type: 'retail', daysAgo: 0, hoursOffset: 1, paymentMode: 'cash', items: [
        { medicineName: 'Paracetamol 500mg', quantity: 2 },
        { medicineName: 'Dolo 650', quantity: 1 },
      ]},
      { customerIdx: 0, counterName: 'Counter A', type: 'retail', daysAgo: 0, hoursOffset: 2, paymentMode: 'cash', doctorName: 'Dr. A.K. Singh', prescriptionNo: 'P-001', items: [
        { medicineName: 'Combiflam', quantity: 2 },
        { medicineName: 'Omeprazole 20mg', quantity: 1 },
      ]},
      { customerIdx: 2, counterName: 'Counter B', type: 'retail', daysAgo: 0, hoursOffset: 3, paymentMode: 'card', items: [
        { medicineName: 'Vitamin D3 60K IU', quantity: 3 },
        { medicineName: 'Shelcal 500mg', quantity: 1 },
      ]},
      { customerIdx: 3, counterName: 'Counter A', type: 'wholesale', daysAgo: 0, hoursOffset: 4, paymentMode: 'credit', items: [
        { medicineName: 'Metformin 500mg', quantity: 50 },
        { medicineName: 'Becosules', quantity: 30 },
      ]},
      { customerIdx: -1, counterName: 'Counter C', type: 'retail', daysAgo: 0, hoursOffset: 5, paymentMode: 'cash', items: [
        { medicineName: 'Candid Cream', quantity: 1 },
      ]},
      { customerIdx: 1, counterName: 'Counter B', type: 'retail', daysAgo: 0, hoursOffset: 6, paymentMode: 'upi', doctorName: 'Dr. Meera Patel', items: [
        { medicineName: 'Amoxicillin 250mg', quantity: 2 },
        { medicineName: 'Azithromycin 500mg', quantity: 1 },
      ]},
      // Yesterday's sales
      { customerIdx: 4, counterName: 'Counter A', type: 'retail', daysAgo: 1, hoursOffset: 2, paymentMode: 'cash', items: [
        { medicineName: 'Paracetamol 500mg', quantity: 1 },
        { medicineName: 'Combiflam', quantity: 1 },
        { medicineName: 'Benadryl Cough Syrup', quantity: 1 },
      ]},
      { customerIdx: 5, counterName: 'Counter B', type: 'retail', daysAgo: 1, hoursOffset: 4, paymentMode: 'card', items: [
        { medicineName: 'Atorvastatin 10mg', quantity: 2 },
        { medicineName: 'Telma 40', quantity: 1 },
        { medicineName: 'Glycomet GP 2', quantity: 1 },
      ]},
      { customerIdx: -1, counterName: 'Counter C', type: 'retail', daysAgo: 1, hoursOffset: 6, paymentMode: 'cash', items: [
        { medicineName: 'Refresh Tears', quantity: 1 },
      ]},
      // 2 days ago
      { customerIdx: 6, counterName: 'Counter A', type: 'retail', daysAgo: 2, hoursOffset: 1, paymentMode: 'upi', items: [
        { medicineName: 'Amlip 5mg', quantity: 2 },
        { medicineName: 'Pantoprazole 40mg', quantity: 1 },
      ]},
      { customerIdx: 7, counterName: 'Counter B', type: 'wholesale', daysAgo: 2, hoursOffset: 3, paymentMode: 'cash', items: [
        { medicineName: 'Montair LC', quantity: 5 },
        { medicineName: 'Seroflo Inhaler 250', quantity: 2 },
      ]},
      // 3 days ago
      { customerIdx: 8, counterName: 'Counter C', type: 'retail', daysAgo: 3, hoursOffset: 2, paymentMode: 'cash', items: [
        { medicineName: 'Honitus Syrup', quantity: 1 },
        { medicineName: 'ORS Powder', quantity: 3 },
        { medicineName: 'Becosules', quantity: 2 },
      ]},
      // 5 days ago
      { customerIdx: 9, counterName: 'Counter A', type: 'retail', daysAgo: 5, hoursOffset: 3, paymentMode: 'card', items: [
        { medicineName: 'Chyawanprash', quantity: 1 },
        { medicineName: 'Ashwagandha Churna', quantity: 1 },
        { medicineName: 'Autrin', quantity: 1 },
      ]},
      // 7 days ago
      { customerIdx: -1, counterName: 'Counter B', type: 'retail', daysAgo: 7, hoursOffset: 1, paymentMode: 'cash', items: [
        { medicineName: 'Ciplox Eye Drops', quantity: 1 },
        { medicineName: 'Betadine Ointment', quantity: 1 },
      ]},
      // 10 days ago
      { customerIdx: 10, counterName: 'Counter A', type: 'retail', daysAgo: 10, hoursOffset: 2, paymentMode: 'upi', items: [
        { medicineName: 'Moov Cream', quantity: 1 },
        { medicineName: 'Shahi Balm', quantity: 1 },
        { medicineName: 'Dettol Handwash', quantity: 1 },
      ]},
    ]

    const invoices: Array<{ id: string; date: Date; totalAmount: number; paymentMode: string }> = []

    for (const saleDef of saleDefs) {
      const saleItems: Array<{ medicineId: string; batchId: string; batchNo: string; quantity: number; costPrice: number; mrp: number; sellingPrice: number; gstRate: number }> = []

      for (const itemDef of saleDef.items) {
        const found = findBatch(itemDef.medicineName)
        if (!found) continue
        saleItems.push({
          medicineId: found.med.id,
          batchId: found.batchId,
          batchNo: found.info.batchNo,
          quantity: itemDef.quantity,
          costPrice: found.info.costPrice,
          mrp: found.info.mrp,
          sellingPrice: saleDef.type === 'wholesale' ? found.info.wholesalePrice : found.info.sellingPrice,
          gstRate: found.med.gstRate,
        })
      }

      if (saleItems.length === 0) continue

      let subtotal = 0
      let totalGst = 0
      const itemData = saleItems.map(i => {
        const itemGst = Math.round(i.sellingPrice * i.quantity * i.gstRate / 100 * 100) / 100
        const itemTotal = Math.round((i.sellingPrice * i.quantity + itemGst) * 100) / 100
        subtotal += i.sellingPrice * i.quantity
        totalGst += itemGst
        return { ...i, gstAmount: itemGst, totalAmount: itemTotal }
      })

      const totalAmount = Math.round(subtotal + totalGst)

      const saleDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - saleDef.daysAgo, 8 + saleDef.hoursOffset, 15 * (saleDef.daysAgo + 1) % 60)

      const invoice = await db.salesInvoice.create({
        data: {
          invoiceNo: invNo(),
          customerId: saleDef.customerIdx >= 0 ? customers[saleDef.customerIdx].id : null,
          counterId: ctr[saleDef.counterName],
          type: saleDef.type,
          date: saleDate,
          subtotal: Math.round(subtotal * 100) / 100,
          gstAmount: Math.round(totalGst * 100) / 100,
          roundOff: 0,
          totalAmount,
          paidAmount: totalAmount,
          paymentMode: saleDef.paymentMode,
          doctorName: saleDef.doctorName,
          prescriptionNo: saleDef.prescriptionNo,
          createdBy: staffList[Math.min(saleDef.daysAgo, 2)].id,
          items: {
            create: itemData.map(i => {
              const med = medicines.find(m => m.id === i.medicineId)
              return {
                medicineId: i.medicineId,
                batchId: i.batchId,
                batchNo: i.batchNo,
                hsnCode: med?.hsnCode || undefined,
                gstRate: i.gstRate,
                costPrice: i.costPrice,
                mrp: i.mrp,
                sellingPrice: i.sellingPrice,
                quantity: i.quantity,
                gstAmount: i.gstAmount,
                totalAmount: i.totalAmount,
              }
            }),
          },
          payments: {
            create: { amount: totalAmount, mode: saleDef.paymentMode },
          },
        },
      })

      // Deduct stock
      for (const item of saleItems) {
        await db.medicineBatch.update({
          where: { id: item.batchId },
          data: { currentStock: { decrement: item.quantity } },
        })
        if (batchInfo[item.batchId]) {
          batchInfo[item.batchId].currentStock -= item.quantity
        }
      }

      invoices.push({ id: invoice.id, date: invoice.date, totalAmount: invoice.totalAmount, paymentMode: invoice.paymentMode })
    }

    // ============ DAY BOOK ============
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayInvoices = invoices.filter(inv => new Date(inv.date) >= todayStart)
    const cashSales = todayInvoices.filter(i => i.paymentMode === 'cash').reduce((s, i) => s + i.totalAmount, 0)
    const cardSales = todayInvoices.filter(i => i.paymentMode === 'card').reduce((s, i) => s + i.totalAmount, 0)
    const upiSales = todayInvoices.filter(i => i.paymentMode === 'upi').reduce((s, i) => s + i.totalAmount, 0)

    await db.dayBook.create({
      data: {
        counterId: ctr['Counter A'],
        date: today,
        openingCash: 5000,
        openingCard: 0,
        openingUPI: 0,
        totalCashSales: Math.round(cashSales * 100) / 100,
        totalCardSales: Math.round(cardSales * 100) / 100,
        totalUPISales: Math.round(upiSales * 100) / 100,
        totalSales: Math.round(todayInvoices.reduce((s, i) => s + i.totalAmount, 0) * 100) / 100,
        closingCash: Math.round((5000 + cashSales) * 100) / 100,
        closingCard: Math.round(cardSales * 100) / 100,
        closingUPI: Math.round(upiSales * 100) / 100,
        status: 'open',
        openedBy: staff['Admin User'],
      },
    })

    // ============ HELPER: Find batch ID ============
    function getBatchId(medName: string, batchNo?: string): string | null {
      const med = medMap[medName]
      if (!med) return null
      const entries = Object.entries(batchInfo).filter(([, v]) => v.medicineId === med.id)
      if (batchNo) {
        const match = entries.find(([, v]) => v.batchNo === batchNo)
        return match ? match[0] : null
      }
      return entries.length > 0 ? entries[0][0] : null
    }

    // ============ SCHEMES ============
    const schemes = await Promise.all([
      db.scheme.create({
        data: {
          name: 'Buy 10 Get 1 Free',
          type: 'buy_x_get_y',
          description: 'Buy 10 strips of Paracetamol 500mg, get 1 strip free from MediCorp',
          supplierId: sup['MediCorp Distributors'],
          buyQty: 10,
          getQty: 1,
          scope: 'specific',
          medicineId: medMap['Paracetamol 500mg'].id,
          validFrom: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30),
          validTo: new Date(today.getFullYear(), today.getMonth() + 1, today.getDate()),
          isActive: true,
        },
      }),
      db.scheme.create({
        data: {
          name: 'Cipla Flat 10% Off',
          type: 'flat_discount',
          description: 'Flat 10% discount on all Cipla manufactured medicines',
          flatDiscount: 10,
          scope: 'manufacturer',
          manufacturerId: mfr['Cipla'],
          validFrom: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 15),
          validTo: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 45),
          isActive: true,
        },
      }),
      db.scheme.create({
        data: {
          name: 'Bulk Tablets 5% Off',
          type: 'quantity_discount',
          description: '5% discount on all tablet purchases of 20+ strips',
          minQty: 20,
          qtyDiscountPct: 5,
          scope: 'category',
          categoryId: cat['Tablets'],
          validFrom: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 10),
          validTo: new Date(today.getFullYear(), today.getMonth() + 2, today.getDate()),
          isActive: true,
        },
      }),
      db.scheme.create({
        data: {
          name: 'Dolo 650 Buy 3 Get 1',
          type: 'buy_x_get_y',
          description: 'Special Dolo 650 promotion - Buy 3 strips, get 1 free',
          buyQty: 3,
          getQty: 1,
          scope: 'specific',
          medicineId: medMap['Dolo 650'].id,
          validFrom: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7),
          validTo: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 23),
          isActive: true,
        },
      }),
      db.scheme.create({
        data: {
          name: 'Monsoon Sale - Syrups 15% Off',
          type: 'flat_discount',
          description: 'Monsoon special - 15% off on all cough syrups and liquid preparations',
          flatDiscount: 15,
          scope: 'category',
          categoryId: cat['Syrups'],
          validFrom: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3),
          validTo: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 27),
          isActive: true,
        },
      }),
    ])

    // ============ UNIT CONVERSIONS ============
    await Promise.all([
      db.unitConversion.create({ data: { medicineId: medMap['Paracetamol 500mg'].id, fromUnit: 'box', toUnit: 'strip', factor: 10 } }),
      db.unitConversion.create({ data: { medicineId: medMap['Dolo 650'].id, fromUnit: 'box', toUnit: 'strip', factor: 10 } }),
      db.unitConversion.create({ data: { medicineId: medMap['Becosules'].id, fromUnit: 'box', toUnit: 'strip', factor: 10 } }),
      db.unitConversion.create({ data: { medicineId: medMap['Surgicare Face Mask'].id, fromUnit: 'pack', toUnit: 'piece', factor: 50 } }),
      db.unitConversion.create({ data: { medicineId: medMap['Dettol Handwash'].id, fromUnit: 'box', toUnit: 'bottle', factor: 12 } }),
    ])

    // ============ PRESCRIPTIONS ============
    await Promise.all([
      db.prescription.create({
        data: {
          invoiceId: invoices[1].id,
          patientName: 'Ramesh Gupta',
          patientPhone: '9812345001',
          patientAge: 45,
          patientGender: 'male',
          doctorName: 'Dr. A.K. Singh',
          doctorRegNo: 'PMC-2010-4521',
          notes: 'Fever and body ache - 5 days',
          status: 'used',
        },
      }),
      db.prescription.create({
        data: {
          invoiceId: invoices[5].id,
          patientName: 'Sunita Devi',
          patientPhone: '9812345002',
          patientAge: 32,
          patientGender: 'female',
          doctorName: 'Dr. Meera Patel',
          doctorRegNo: 'PMC-2015-7823',
          notes: 'Upper respiratory tract infection',
          status: 'used',
        },
      }),
      db.prescription.create({
        data: {
          patientName: 'Amit Verma',
          patientPhone: '9876543210',
          patientAge: 55,
          patientGender: 'male',
          doctorName: 'Dr. Suresh Kumar',
          doctorRegNo: 'DMC-2008-3456',
          notes: 'Type 2 Diabetes - ongoing medication. Continue Metformin and Glycomet GP 2.',
          status: 'active',
        },
      }),
      db.prescription.create({
        data: {
          patientName: 'Neeta Rani',
          patientPhone: '9876543299',
          patientAge: 28,
          patientGender: 'female',
          doctorName: 'Dr. P.K. Gupta',
          doctorRegNo: 'MMC-2012-5678',
          notes: 'Prenatal vitamins - Iron and Calcium supplements',
          status: 'active',
        },
      }),
    ])

    // ============ AUDIT LOG ============
    await Promise.all([
      // Rate changes
      db.auditLog.create({
        data: {
          module: 'medicine', action: 'rate_change',
          entityId: medMap['Dolo 650'].id, entityType: 'Medicine',
          fieldName: 'mrp', oldValue: '38', newValue: '42',
          description: 'Dolo 650 MRP revised from \u20b938 to \u20b942 per strip',
          userId: staff['Admin User'],
          createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 15),
        },
      }),
      db.auditLog.create({
        data: {
          module: 'medicine', action: 'rate_change',
          entityId: medMap['Combiflam'].id, entityType: 'Medicine',
          fieldName: 'mrp', oldValue: '44', newValue: '48',
          description: 'Combiflam MRP revised from \u20b944 to \u20b948 per strip',
          userId: staff['Admin User'],
          createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 10),
        },
      }),
      db.auditLog.create({
        data: {
          module: 'batch', action: 'rate_change',
          entityId: getBatchId('Omeprazole 20mg', 'B2024013')!, entityType: 'MedicineBatch',
          fieldName: 'sellingPrice', oldValue: '48.5', newValue: '52',
          description: 'Omeprazole 20mg selling price updated for batch B2024013',
          userId: staff['Dr. Meera Patel'],
          createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 8),
        },
      }),
      db.auditLog.create({
        data: {
          module: 'medicine', action: 'rate_change',
          entityId: medMap['Shelcal 500mg'].id, entityType: 'Medicine',
          fieldName: 'mrp', oldValue: '165', newValue: '178',
          description: 'Shelcal 500mg MRP revised from \u20b9165 to \u20b9178 per bottle',
          userId: staff['Admin User'],
          createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 5),
        },
      }),
      db.auditLog.create({
        data: {
          module: 'medicine', action: 'rate_change',
          entityId: medMap['Cetirizine 10mg'].id, entityType: 'Medicine',
          fieldName: 'mrp', oldValue: '32', newValue: '35',
          description: 'Cetirizine 10mg MRP revised from \u20b932 to \u20b935 per strip',
          userId: staff['Dr. Meera Patel'],
          createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 12),
        },
      }),
      // Stock adjustments
      db.auditLog.create({
        data: {
          module: 'stock', action: 'stock_change',
          entityId: getBatchId('Refresh Tears', 'B2024021')!, entityType: 'MedicineBatch',
          fieldName: 'currentStock', oldValue: '20', newValue: '15',
          description: 'Refresh Tears batch B2024021: 5 units damaged during handling, stock adjusted',
          userId: staff['Dr. Meera Patel'],
          createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6),
        },
      }),
      db.auditLog.create({
        data: {
          module: 'stock', action: 'stock_change',
          entityId: getBatchId('Seroflo Inhaler 250', 'B2024028')!, entityType: 'MedicineBatch',
          fieldName: 'currentStock', oldValue: '12', newValue: '8',
          description: 'Seroflo Inhaler batch B2024028: 4 units expired, removed from stock',
          userId: staff['Admin User'],
          createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3),
        },
      }),
      // Invoice modifications
      db.auditLog.create({
        data: {
          module: 'invoice', action: 'update',
          entityId: invoices[3].id, entityType: 'SalesInvoice',
          fieldName: 'discount', oldValue: '0', newValue: '200',
          description: 'Wholesale invoice discount of \u20b9200 applied for City Medical Store',
          userId: staff['Admin User'],
          createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1),
        },
      }),
      db.auditLog.create({
        data: {
          module: 'invoice', action: 'update',
          entityId: invoices[9].id, entityType: 'SalesInvoice',
          fieldName: 'paymentMode', oldValue: 'upi', newValue: 'credit',
          description: 'Meena Hospital payment mode changed to credit',
          userId: staff['Admin User'],
          createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2),
        },
      }),
      // Customer update
      db.auditLog.create({
        data: {
          module: 'customer', action: 'update',
          entityId: customers[3].id, entityType: 'Customer',
          fieldName: 'creditLimit', oldValue: '75000', newValue: '100000',
          description: 'City Medical Store credit limit increased from \u20b975,000 to \u20b91,00,000',
          userId: staff['Admin User'],
          createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 4),
        },
      }),
    ])

    // ============ NOTIFICATIONS ============
    await Promise.all([
      // Low stock alerts
      db.notification.create({
        data: {
          type: 'low_stock',
          title: 'Low Stock: Omeprazole 20mg',
          message: 'Omeprazole 20mg current stock (20 units) is near minimum level (30 units). Reorder recommended.',
          module: 'inventory',
          priority: 'warning',
          referenceId: medMap['Omeprazole 20mg'].id,
          expiresAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7),
          isRead: false,
        },
      }),
      db.notification.create({
        data: {
          type: 'low_stock',
          title: 'Critical Stock: Refresh Tears',
          message: 'Refresh Tears stock critically low (15 units). Immediate reorder required.',
          module: 'inventory',
          priority: 'critical',
          referenceId: medMap['Refresh Tears'].id,
          expiresAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3),
          isRead: false,
        },
      }),
      // Expiry warnings
      db.notification.create({
        data: {
          type: 'expiry_warning',
          title: 'Expiry Alert: Paracetamol 500mg (B2024002)',
          message: 'Batch B2024002 of Paracetamol 500mg expires in 3 months. 50 units need to be cleared.',
          module: 'inventory',
          priority: 'warning',
          referenceId: getBatchId('Paracetamol 500mg', 'B2024002')!,
          expiresAt: new Date(today.getFullYear(), today.getMonth() + 1, today.getDate()),
          isRead: true,
        },
      }),
      db.notification.create({
        data: {
          type: 'expiry_warning',
          title: 'Expiry Alert: Combiflam (B2024006)',
          message: 'Batch B2024006 of Combiflam expires in 4 months (30 units). Consider return or promotion.',
          module: 'inventory',
          priority: 'info',
          referenceId: getBatchId('Combiflam', 'B2024006')!,
          expiresAt: new Date(today.getFullYear(), today.getMonth() + 1, today.getDate() + 15),
          isRead: false,
        },
      }),
      db.notification.create({
        data: {
          type: 'expiry_warning',
          title: 'URGENT: Omeprazole 20mg (B2024014) Expiring Soon',
          message: 'Batch B2024014 of Omeprazole 20mg expires in 2 months! Only 20 units remaining. File return claim immediately.',
          module: 'inventory',
          priority: 'critical',
          referenceId: getBatchId('Omeprazole 20mg', 'B2024014')!,
          expiresAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5),
          isRead: false,
        },
      }),
      // Credit overdue
      db.notification.create({
        data: {
          type: 'credit_overdue',
          title: 'Credit Overdue: City Medical Store',
          message: 'City Medical Store has an outstanding balance of \u20b922,000. Credit limit \u20b91,00,000. Last payment was 15 days ago.',
          module: 'customers',
          priority: 'warning',
          referenceId: customers[3].id,
          expiresAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10),
          isRead: true,
        },
      }),
      db.notification.create({
        data: {
          type: 'credit_overdue',
          title: 'Credit Overdue: Meena Hospital',
          message: 'Meena Hospital has an outstanding balance of \u20b945,000 against credit limit of \u20b92,00,000. Payment reminder sent.',
          module: 'customers',
          priority: 'critical',
          referenceId: customers[6].id,
          expiresAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5),
          isRead: false,
        },
      }),
      db.notification.create({
        data: {
          type: 'scheme_expiry',
          title: 'Scheme Expiring: Dolo 650 Buy 3 Get 1',
          message: 'The Dolo 650 promotional scheme "Buy 3 Get 1" expires in 23 days. Review and extend if needed.',
          module: 'dashboard',
          priority: 'info',
          expiresAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 20),
          isRead: false,
        },
      }),
    ])

    // ============ DELIVERIES ============
    await Promise.all([
      db.delivery.create({
        data: {
          invoiceId: invoices[1].id,
          customerId: customers[0].id,
          patientName: 'Ramesh Gupta',
          address: '45, Sector 15, Chandigarh',
          phone: '9812345001',
          status: 'delivered',
          deliveryBoy: 'Rajinder Singh',
          codAmount: 0,
          assignedAt: new Date(invoices[1].date.getTime() + 30 * 60000),
          deliveredAt: new Date(invoices[1].date.getTime() + 120 * 60000),
          notes: 'Delivered to reception. Patient not at home, collected by family member.',
        },
      }),
      db.delivery.create({
        data: {
          invoiceId: invoices[6].id,
          customerId: customers[4].id,
          patientName: 'Priya Sharma',
          address: 'Flat 201, Sunny Enclave, Kharar',
          phone: '9812345005',
          status: 'in_transit',
          deliveryBoy: 'Gurpreet Kaur',
          codAmount: invoices[6].totalAmount,
          assignedAt: new Date(invoices[6].date.getTime() + 15 * 60000),
          notes: 'COD order. Patient requested evening delivery.',
        },
      }),
      db.delivery.create({
        data: {
          invoiceId: invoices[9].id,
          customerId: customers[6].id,
          patientName: 'Meena Hospital Pharmacy',
          address: 'GT Road, Ambala Cantt',
          phone: '9812345007',
          status: 'pending',
          notes: 'Bulk institutional delivery. Arrange transport van.',
        },
      }),
    ])

    // ============ CLAIMS ============
    await Promise.all([
      db.claim.create({
        data: {
          supplierId: sup['Pharma Supply Chain'],
          batchId: getBatchId('Omeprazole 20mg', 'B2024014')!,
          claimType: 'expiry',
          claimDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2),
          quantity: 20,
          unitCost: 23,
          totalAmount: 460,
          status: 'pending',
          notes: '20 units of Omeprazole 20mg batch B2024014 approaching expiry within 2 months. Requesting replacement or credit note.',
        },
      }),
      db.claim.create({
        data: {
          supplierId: sup['Regional Pharma Traders'],
          batchId: getBatchId('Surgicare Face Mask', 'B2024040')!,
          claimType: 'damage',
          claimDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 5),
          quantity: 15,
          unitCost: 35,
          totalAmount: 525,
          status: 'approved',
          approvedBy: staff['Admin User'],
          approvedAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3),
          creditNoteNo: 'CN-2024-001',
          notes: '15 masks from pack received with torn packaging. Photos shared with supplier.',
        },
      }),
      db.claim.create({
        data: {
          supplierId: sup['HealthCare Wholesalers'],
          batchId: getBatchId('Seroflo Inhaler 250', 'B2024028')!,
          claimType: 'short_supply',
          claimDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7),
          quantity: 4,
          unitCost: 200,
          totalAmount: 800,
          status: 'approved',
          approvedBy: staff['Admin User'],
          approvedAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 4),
          creditNoteNo: 'CN-2024-002',
          notes: 'PO for Seroflo Inhaler 250 had 12 units but only 8 received. Short supply of 4 units.',
        },
      }),
    ])

    // ============ RATE CONTRACTS ============
    await db.rateContract.create({
      data: {
        customerId: customers[6].id,
        name: 'Meena Hospital Annual Rate Contract 2024',
        validFrom: new Date(today.getFullYear(), 0, 1),
        validTo: new Date(today.getFullYear(), 11, 31),
        discountPct: 12,
        notes: 'Annual institutional rate contract with Meena Hospital. 12% discount on MRP for all listed items.',
        status: 'active',
        items: {
          create: [
            { medicineId: medMap['Paracetamol 500mg'].id, agreedPrice: 16, minQty: 50, maxQty: 500 },
            { medicineId: medMap['Dolo 650'].id, agreedPrice: 37, minQty: 30, maxQty: 300 },
            { medicineId: medMap['Metformin 500mg'].id, agreedPrice: 24.5, minQty: 100, maxQty: 1000 },
            { medicineId: medMap['Omeprazole 20mg'].id, agreedPrice: 45, minQty: 50, maxQty: 500 },
            { medicineId: medMap['Amoxicillin 250mg'].id, agreedPrice: 68, minQty: 30, maxQty: 200 },
          ],
        },
      },
    })
    await db.rateContract.create({
      data: {
        customerId: customers[3].id,
        name: 'City Medical Store Wholesale Agreement',
        validFrom: new Date(today.getFullYear(), today.getMonth(), 1),
        validTo: new Date(today.getFullYear(), today.getMonth() + 6, 1),
        discountPct: 8,
        notes: 'Wholesale rate agreement with City Medical Store. 8% discount on MRP for bulk purchases.',
        status: 'active',
        items: {
          create: [
            { medicineId: medMap['Becosules'].id, agreedPrice: 38, minQty: 50 },
            { medicineId: medMap['Cetirizine 10mg'].id, agreedPrice: 31.5, minQty: 100 },
            { medicineId: medMap['Pantoprazole 40mg'].id, agreedPrice: 58, minQty: 50 },
          ],
        },
      },
    })

    // ============ COMMISSION ============
    await Promise.all([
      db.commission.create({
        data: {
          staffId: staff['Rahul Verma'],
          month: today.getMonth() + 1,
          year: today.getFullYear(),
          totalSales: 185000,
          totalProfit: 32000,
          commissionPct: 2,
          commissionAmt: 640,
          status: 'calculated',
          notes: `Monthly commission for ${new Date(today.getFullYear(), today.getMonth(), 1).toLocaleString('en-IN', { month: 'long' })} ${today.getFullYear()}. Excellent performance, 15% above target.`,
        },
      }),
      db.commission.create({
        data: {
          staffId: staff['Dr. Meera Patel'],
          month: today.getMonth() + 1,
          year: today.getFullYear(),
          totalSales: 245000,
          totalProfit: 42000,
          commissionPct: 2,
          commissionAmt: 840,
          status: 'calculated',
          notes: `Monthly commission for ${new Date(today.getFullYear(), today.getMonth(), 1).toLocaleString('en-IN', { month: 'long' })} ${today.getFullYear()}. Highest sales among all staff.`,
        },
      }),
      db.commission.create({
        data: {
          staffId: staff['Rahul Verma'],
          month: today.getMonth(),
          year: today.getFullYear(),
          totalSales: 162000,
          totalProfit: 27500,
          commissionPct: 2,
          commissionAmt: 550,
          status: 'paid',
          paidAt: new Date(today.getFullYear(), today.getMonth(), 5),
          notes: `Monthly commission for ${new Date(today.getFullYear(), today.getMonth() - 1, 1).toLocaleString('en-IN', { month: 'long' })} ${today.getFullYear()}. Paid via bank transfer on 5th.`,
        },
      }),
    ])

    // ============ MRP HISTORY ============
    await Promise.all([
      db.mrpHistory.create({
        data: {
          medicineId: medMap['Dolo 650'].id,
          batchId: getBatchId('Dolo 650', 'B2024003'),
          oldMrp: 38,
          newMrp: 42,
          reason: 'Manufacturer price revision - Mankind increased trade rates',
          changedBy: staff['Admin User'],
          createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 15),
        },
      }),
      db.mrpHistory.create({
        data: {
          medicineId: medMap['Combiflam'].id,
          batchId: getBatchId('Combiflam', 'B2024005'),
          oldMrp: 44,
          newMrp: 48,
          reason: 'Abbott price hike effective from June 2024',
          changedBy: staff['Admin User'],
          createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 10),
        },
      }),
      db.mrpHistory.create({
        data: {
          medicineId: medMap['Shelcal 500mg'].id,
          batchId: getBatchId('Shelcal 500mg', 'B2024016'),
          oldMrp: 165,
          newMrp: 178,
          reason: 'Abbott nutrition division price revision',
          changedBy: staff['Admin User'],
          createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 5),
        },
      }),
      db.mrpHistory.create({
        data: {
          medicineId: medMap['Cetirizine 10mg'].id,
          batchId: getBatchId('Cetirizine 10mg', 'B2024043'),
          oldMrp: 32,
          newMrp: 35,
          reason: "Dr. Reddy's seasonal price adjustment",
          changedBy: staff['Dr. Meera Patel'],
          createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 12),
        },
      }),
      db.mrpHistory.create({
        data: {
          medicineId: medMap['Montair LC'].id,
          batchId: getBatchId('Montair LC', 'B2024037'),
          oldMrp: 155,
          newMrp: 168,
          reason: 'Cipla respiratory segment price update',
          changedBy: staff['Admin User'],
          createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 20),
        },
      }),
    ])

    const elapsed = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      elapsed: `${elapsed}ms`,
      summary: {
        categories: categories.length,
        manufacturers: manufacturers.length,
        suppliers: suppliers.length,
        medicines: medicines.length,
        batches: Object.keys(batchInfo).length,
        customers: customers.length,
        staff: staffList.length,
        counters: counters.length,
        purchaseOrders: poDefs.length,
        salesInvoices: invoices.length,
        dayBooks: 1,
        schemes: schemes.length,
        unitConversions: 5,
        prescriptions: 4,
        auditLogs: 10,
        notifications: 8,
        deliveries: 3,
        claims: 3,
        rateContracts: 2,
        commissions: 3,
        mrpHistory: 5,
      },
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error', stack: error instanceof Error ? error.stack : undefined },
      { status: 500 }
    )
  }
}
