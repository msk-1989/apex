import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const categories = await Promise.all([
    db.category.upsert({ where: { name: 'Pain Relief' }, update: {}, create: { name: 'Pain Relief', description: 'Analgesics and NSAIDs' } }),
    db.category.upsert({ where: { name: 'Antibiotics' }, update: {}, create: { name: 'Antibiotics', description: 'Antibacterial medicines' } }),
    db.category.upsert({ where: { name: 'Vitamins' }, update: {}, create: { name: 'Vitamins', description: 'Vitamin supplements' } }),
    db.category.upsert({ where: { name: 'Diabetes' }, update: {}, create: { name: 'Diabetes', description: 'Anti-diabetic medicines' } }),
    db.category.upsert({ where: { name: 'Cardiac' }, update: {}, create: { name: 'Cardiac', description: 'Heart and BP medicines' } }),
    db.category.upsert({ where: { name: 'Gastro' }, update: {}, create: { name: 'Gastro', description: 'Gastrointestinal medicines' } }),
    db.category.upsert({ where: { name: 'Cold & Cough' }, update: {}, create: { name: 'Cold & Cough', description: 'Cold, cough, and allergy' } }),
    db.category.upsert({ where: { name: 'Skin Care' }, update: {}, create: { name: 'Skin Care', description: 'Dermatology' } }),
    db.category.upsert({ where: { name: 'Eye & Ear' }, update: {}, create: { name: 'Eye & Ear', description: 'Ophthalmic and ENT' } }),
    db.category.upsert({ where: { name: 'Personal Care' }, update: {}, create: { name: 'Personal Care', description: 'Personal hygiene products' } }),
  ])

  const manufacturers = await Promise.all([
    db.manufacturer.upsert({ where: { name: 'Sun Pharma' }, update: {}, create: { name: 'Sun Pharma', phone: '022-6801-6801', gstNo: '27AABCS1429B1Z5' } }),
    db.manufacturer.upsert({ where: { name: 'Cipla' }, update: {}, create: { name: 'Cipla', phone: '022-2420-2420', gstNo: '27AABCC7580K1Z3' } }),
    db.manufacturer.upsert({ where: { name: 'Dabur' }, update: {}, create: { name: 'Dabur', phone: '011-2334-2334', gstNo: '07AABCD1234P1Z1' } }),
    db.manufacturer.upsert({ where: { name: 'Dr. Reddys' }, update: {}, create: { name: 'Dr. Reddys', phone: '040-4900-4900', gstNo: '36AABCD5678P1Z2' } }),
    db.manufacturer.upsert({ where: { name: 'Lupin' }, update: {}, create: { name: 'Lupin', phone: '022-6801-6800', gstNo: '27AABCL9876P1Z5' } }),
    db.manufacturer.upsert({ where: { name: 'Abbott' }, update: {}, create: { name: 'Abbott', phone: '022-2424-2424', gstNo: '27AABCA5432B1Z1' } }),
    db.manufacturer.upsert({ where: { name: 'Mankind' }, update: {}, create: { name: 'Mankind', phone: '011-4140-4140', gstNo: '07AABCM7890P1Z3' } }),
    db.manufacturer.upsert({ where: { name: 'GSK' }, update: {}, create: { name: 'GSK', phone: '022-2757-2757', gstNo: '27AABCG2345B1Z2' } }),
  ])

  await db.counter.upsert({
    where: { code: 'POS-1' },
    update: {},
    create: { name: 'Main Counter', code: 'POS-1' }
  })

  const medicines = [
    { name: 'Dolo 650', genericName: 'Paracetamol', saltComposition: 'Paracetamol 650mg', catIdx: 0, mfgIdx: 1, strength: '650mg', form: 'tablet', unit: 'strip', stripQty: 15, gstRate: 12, schedule: 'none', hsnCode: '30049099' },
    { name: 'Augmentin 625 Duo', genericName: 'Amoxicillin + Clavulanic Acid', saltComposition: 'Amoxicillin 500mg + Clavulanic Acid 125mg', catIdx: 1, mfgIdx: 1, strength: '625mg', form: 'tablet', unit: 'strip', stripQty: 10, gstRate: 12, schedule: 'H', hsnCode: '30041099' },
    { name: 'Azithral 500', genericName: 'Azithromycin', saltComposition: 'Azithromycin 500mg', catIdx: 1, mfgIdx: 0, strength: '500mg', form: 'tablet', unit: 'strip', stripQty: 3, gstRate: 12, schedule: 'H', hsnCode: '30041099' },
    { name: 'Pan-D', genericName: 'Pantoprazole + Domperidone', saltComposition: 'Pantoprazole 40mg + Domperidone 30mg', catIdx: 5, mfgIdx: 6, strength: '40mg/30mg', form: 'capsule', unit: 'strip', stripQty: 15, gstRate: 12, schedule: 'H', hsnCode: '30049099' },
    { name: 'Shelcal 500', genericName: 'Calcium + Vitamin D3', saltComposition: 'Calcium 500mg + Vitamin D3 250IU', catIdx: 2, mfgIdx: 3, strength: '500mg', form: 'tablet', unit: 'bottle', stripQty: 30, gstRate: 12, schedule: 'none', hsnCode: '30049099' },
    { name: 'Glycomet GP 2', genericName: 'Metformin + Glimepiride', saltComposition: 'Metformin 500mg + Glimepiride 2mg', catIdx: 3, mfgIdx: 0, strength: '500mg/2mg', form: 'tablet', unit: 'strip', stripQty: 10, gstRate: 12, schedule: 'H', hsnCode: '30049099' },
    { name: 'Ecosprin 75', genericName: 'Aspirin', saltComposition: 'Aspirin 75mg', catIdx: 4, mfgIdx: 1, strength: '75mg', form: 'tablet', unit: 'strip', stripQty: 14, gstRate: 12, schedule: 'none', hsnCode: '30049099' },
    { name: 'Telma 40', genericName: 'Telmisartan', saltComposition: 'Telmisartan 40mg', catIdx: 4, mfgIdx: 3, strength: '40mg', form: 'tablet', unit: 'strip', stripQty: 15, gstRate: 12, schedule: 'H', hsnCode: '30049099' },
    { name: 'Allegra 120', genericName: 'Fexofenadine', saltComposition: 'Fexofenadine 120mg', catIdx: 6, mfgIdx: 7, strength: '120mg', form: 'tablet', unit: 'strip', stripQty: 10, gstRate: 12, schedule: 'none', hsnCode: '30049099' },
    { name: 'Crocin Advance', genericName: 'Paracetamol', saltComposition: 'Paracetamol 500mg', catIdx: 0, mfgIdx: 7, strength: '500mg', form: 'tablet', unit: 'strip', stripQty: 20, gstRate: 5, schedule: 'none', hsnCode: '30049099' },
    { name: 'Vicks Action 500', genericName: 'Paracetamol+Phenylephrine+Caffeine', saltComposition: 'Paracetamol 500mg + Phenylephrine 10mg + Caffeine 30mg', catIdx: 6, mfgIdx: 7, strength: '500mg', form: 'tablet', unit: 'strip', stripQty: 10, gstRate: 12, schedule: 'none', hsnCode: '30049099' },
    { name: 'ORS Electral', genericName: 'Oral Rehydration Salts', saltComposition: 'ORS', catIdx: 5, mfgIdx: 6, strength: '21.8g', form: 'powder', unit: 'pack', stripQty: 1, gstRate: 5, schedule: 'none', hsnCode: '30049099' },
    { name: 'Betadine Ointment', genericName: 'Povidone Iodine', saltComposition: 'Povidone Iodine 5% w/w', catIdx: 7, mfgIdx: 5, strength: '5%', form: 'cream', unit: 'tube', stripQty: 1, gstRate: 5, schedule: 'none', hsnCode: '30049099' },
    { name: 'Moisturex Cream', genericName: 'Aloe Vera + Glycerin', saltComposition: 'Aloe Vera + Glycerin', catIdx: 7, mfgIdx: 6, strength: '100g', form: 'cream', unit: 'tube', stripQty: 1, gstRate: 5, schedule: 'none', hsnCode: '33049990' },
    { name: 'Evion 400', genericName: 'Vitamin E', saltComposition: 'Vitamin E 400mg', catIdx: 2, mfgIdx: 3, strength: '400mg', form: 'capsule', unit: 'strip', stripQty: 20, gstRate: 12, schedule: 'none', hsnCode: '30049099' },
    { name: 'Volini Spray', genericName: 'Diclofenac Diethylamine', saltComposition: 'Diclofenac Diethylamine', catIdx: 0, mfgIdx: 2, strength: '60g', form: 'spray', unit: 'bottle', stripQty: 1, gstRate: 12, schedule: 'none', hsnCode: '30049099' },
    { name: 'Combiflam', genericName: 'Ibuprofen + Paracetamol', saltComposition: 'Ibuprofen 400mg + Paracetamol 325mg', catIdx: 0, mfgIdx: 7, strength: '400mg/325mg', form: 'tablet', unit: 'strip', stripQty: 20, gstRate: 12, schedule: 'none', hsnCode: '30049099' },
    { name: 'Limcee', genericName: 'Vitamin C', saltComposition: 'Ascorbic Acid 500mg', catIdx: 2, mfgIdx: 1, strength: '500mg', form: 'tablet', unit: 'strip', stripQty: 15, gstRate: 12, schedule: 'none', hsnCode: '30049099' },
    { name: 'Montek LC', genericName: 'Montelukast + Levocetirizine', saltComposition: 'Montelukast 10mg + Levocetirizine 5mg', catIdx: 6, mfgIdx: 6, strength: '10mg/5mg', form: 'tablet', unit: 'strip', stripQty: 10, gstRate: 12, schedule: 'H', hsnCode: '30049099' },
    { name: 'Becosules', genericName: 'Vitamin B Complex', saltComposition: 'Vitamin B Complex', catIdx: 2, mfgIdx: 7, strength: 'Complex', form: 'capsule', unit: 'strip', stripQty: 20, gstRate: 12, schedule: 'none', hsnCode: '30049099' },
  ]

  for (const m of medicines) {
    const medicine = await db.medicine.create({
      data: {
        name: m.name,
        genericName: m.genericName,
        saltComposition: m.saltComposition,
        categoryId: categories[m.catIdx].id,
        manufacturerId: manufacturers[m.mfgIdx].id,
        strength: m.strength,
        form: m.form,
        unit: m.unit,
        stripQty: m.stripQty,
        gstRate: m.gstRate,
        schedule: m.schedule,
        hsnCode: m.hsnCode,
      }
    })

    const now = new Date()
    const batchConfigs = [
      { stock: Math.floor(Math.random() * 150) + 20, monthsOffset: Math.floor(Math.random() * 18) + 6 },
      { stock: Math.floor(Math.random() * 100) + 10, monthsOffset: Math.floor(Math.random() * 12) + 3 },
      { stock: Math.floor(Math.random() * 50) + 5, monthsOffset: Math.floor(Math.random() * 6) + 1 },
    ]

    for (let i = 0; i < batchConfigs.length; i++) {
      const bc = batchConfigs[i]
      const batchDate = new Date(now.getFullYear(), now.getMonth() + bc.monthsOffset, 15)
      const baseMrp = parseFloat((Math.random() * 300 + 15).toFixed(2))
      const costPrice = parseFloat((baseMrp * (0.55 + Math.random() * 0.2)).toFixed(2))
      const sellingPrice = parseFloat((baseMrp * (0.85 + Math.random() * 0.1)).toFixed(2))

      await db.medicineBatch.create({
        data: {
          medicineId: medicine.id,
          batchNo: `BN${String(Math.floor(Math.random() * 9000) + 1000)}${String.fromCharCode(65 + i)}`,
          expiryDate: batchDate,
          manufacturingDate: new Date(batchDate.getFullYear() - 2, batchDate.getMonth(), 1),
          costPrice,
          mrp: baseMrp,
          sellingPrice,
          wholesalePrice: parseFloat((sellingPrice * 0.9).toFixed(2)),
          openingStock: bc.stock,
          currentStock: bc.stock,
          minDiscount: 0,
        }
      })
    }
  }

  await Promise.all([
    db.customer.upsert({ where: { id: 'cust-walkin' }, update: {}, create: { id: 'cust-walkin', name: 'Walk-in Customer', type: 'retail', loyaltyPts: 0 } }),
    db.customer.create({ data: { name: 'Rajesh Kumar', phone: '9876543210', email: 'rajesh@email.com', address: '12, MG Road, Mumbai', type: 'retail', loyaltyPts: 250 } }).catch(() => {}),
    db.customer.create({ data: { name: 'Priya Sharma', phone: '9876543211', email: 'priya@email.com', address: '45, Park Street, Delhi', type: 'retail', loyaltyPts: 180 } }).catch(() => {}),
    db.customer.create({ data: { name: 'City Hospital', phone: '9876543212', gstNo: '07AABCH1234P1Z5', dlNo: 'DL-MH-2024-12345', address: '100, Hospital Road, Pune', type: 'institutional', creditLimit: 50000, balance: 12000, loyaltyPts: 5000 } }).catch(() => {}),
    db.customer.create({ data: { name: 'Amit Patel', phone: '9876543213', address: '78, CG Road, Ahmedabad', type: 'retail', loyaltyPts: 90 } }).catch(() => {}),
  ])

  console.log('Seed completed successfully!')
}

main().catch(console.error).finally(() => db.$disconnect())
