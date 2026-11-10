// Sample data used until Supabase is connected. Replace with real Trento merchants.
const S = (id, trn, name, cat, who, phone, brgy, purok, land, lat, lng, bmbe, dti, srp, status, o, c, pay) => ({
  id, trn_code: trn, business_name: name, trade_category: cat, proprietor_name: who, contact_number: phone,
  barangay: brgy, purok, landmark_reference: land, lat, lng, bmbe_registered: bmbe, dti_registered: dti,
  srp_compliant: srp, verification_status: status, open_time: o, close_time: c, accepted_payments: pay
});
export const SEED_STORES = [
  S('s1','TRN-2024-089',"Nena's Sari-Sari & Merienda",'SARI_SARI','Elena C. Perez','+639178894210','Poblacion','Purok 4','Near Trento Gym, across the Purok outpost',8.0461,126.0618,true,true,true,'VERIFIED','06:00','20:30',['CASH','GCASH']),
  S('s2','TRN-2024-012','Trento Public Market Fresh Stalls','FRESH_PRODUCE','Roberto Dela Cruz','+639175551203','Poblacion','Purok 1','Beside the municipal market entrance',8.0472,126.0631,false,true,true,'VERIFIED','05:00','17:00',['CASH']),
  S('s3','TRN-2024-031','Botika ni Mang Tino','PHARMACY','Valentino Reyes','+639189920017','Poblacion','Purok 2','Across Trento Municipal Hall',8.0455,126.0605,true,true,true,'VERIFIED','07:00','21:00',['CASH','GCASH']),
  S('s4','TRN-2024-057',"Aling Rosa's Carinderia",'CARINDERIA','Rosa M. Bautista','+639209914482','San Roque','Purok 3','Near the San Roque chapel',8.0398,126.0702,false,true,true,'VERIFIED','06:00','19:00',['CASH']),
  S('s5','TRN-2024-104','Kapatungan Agri Supply','AGRI','Danilo Tan','+639176620045','Kapatungan','Purok 5','Along the national highway, beside the rice mill',8.0712,126.0483,true,true,true,'VERIFIED','06:30','17:30',['CASH','TRIKE_COD']),
  S('s6','TRN-2024-118','Salvacion Gulay at Prutas','FRESH_PRODUCE','Marites Lopez','+639215530981','Salvacion','Purok 2','Corner of the barangay hall road',8.0285,126.0549,false,false,false,'PENDING','05:30','16:00',['CASH']),
  S('s7','TRN-2024-140','Trento Phone & Gadget Repair','SERVICES','Jomar Villanueva','+639983310764','Poblacion','Purok 6','Second floor, above the bakery',8.0481,126.0589,false,true,true,'VERIFIED','09:00','18:00',['CASH','GCASH']),
  S('s8','TRN-2024-077','Langasian Sari-Sari Store','SARI_SARI','Cora Mendoza','+639171298835','Langasian','Purok 1','Beside the elementary school',8.0603,126.0752,false,true,true,'VERIFIED','06:00','21:00',['CASH'])
];
const P = (id, sid, name, cat, unit, price, cap, stock = true) => ({ id, store_id: sid, name, category: cat, unit, current_price: price, lgu_srp_ceiling: cap, in_stock: stock });
export const SEED_PRODUCTS = [
  P('p1','s2','Well-milled rice','Staples','KG',48,50),
  P('p2','s1','Lakatan bananas (fresh harvest)','Fresh Harvest','KG',45,45),
  P('p3','s2','Cooking oil','Staples','BOTTLE',62,60),
  P('p4','s2','Eggs, medium','Staples','PC',9,10),
  P('p5','s6','Sugar, refined','Staples','KG',92,95),
  P('p6','s1','Instant coffee 3-in-1','Pantry','PC',8,null),
  P('p7','s4','Lunch set (rice, ulam, soup)','Meals','PC',65,null),
  P('p8','s3','Paracetamol 500mg','Medicine','PC',3,null),
  P('p9','s5','Complete fertilizer 14-14-14','Agri','SACK_25KG',1450,null),
  P('p10','s8','Canned sardines','Pantry','PC',24,26),
  P('p11','s2','Tomatoes','Fresh Harvest','KG',70,null,false),
  P('p12','s1','Banana cue (afternoon batch)','Merienda','PC',10,null)
];
