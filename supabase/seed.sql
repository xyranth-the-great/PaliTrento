-- Sample data. Replace with real Trento merchants.
insert into stores (trn_code,business_name,trade_category,proprietor_name,contact_number,barangay,purok,landmark_reference,lat,lng,bmbe_registered,dti_registered,srp_compliant,verification_status,open_time,close_time,accepted_payments) values
('TRN-2024-089','Nena''s Sari-Sari & Merienda','SARI_SARI','Elena C. Perez','+639178894210','Poblacion','Purok 4','Near Trento Gym, across the Purok outpost',8.0461,126.0618,true,true,true,'VERIFIED','06:00','20:30','{CASH,GCASH}'),
('TRN-2024-012','Trento Public Market Fresh Stalls','FRESH_PRODUCE','Roberto Dela Cruz','+639175551203','Poblacion','Purok 1','Beside the municipal market entrance',8.0472,126.0631,false,true,true,'VERIFIED','05:00','17:00','{CASH}'),
('TRN-2024-031','Botika ni Mang Tino','PHARMACY','Valentino Reyes','+639189920017','Poblacion','Purok 2','Across Trento Municipal Hall',8.0455,126.0605,true,true,true,'VERIFIED','07:00','21:00','{CASH,GCASH}'),
('TRN-2024-057','Aling Rosa''s Carinderia','CARINDERIA','Rosa M. Bautista','+639209914482','San Roque','Purok 3','Near the San Roque chapel',8.0398,126.0702,false,true,true,'VERIFIED','06:00','19:00','{CASH}')
on conflict (trn_code) do nothing;

insert into products (store_id,name,category,unit,current_price,lgu_srp_ceiling,in_stock)
select s.id,v.name,v.cat,v.unit,v.price,v.cap,true from (values
 ('TRN-2024-012','Well-milled rice','Staples','KG',48,50),
 ('TRN-2024-012','Cooking oil','Staples','BOTTLE',62,60),
 ('TRN-2024-012','Eggs, medium','Staples','PC',9,10),
 ('TRN-2024-089','Lakatan bananas (fresh harvest)','Fresh Harvest','KG',45,45),
 ('TRN-2024-031','Paracetamol 500mg','Medicine','PC',3,null),
 ('TRN-2024-057','Lunch set (rice, ulam, soup)','Meals','PC',65,null)
) as v(trn,name,cat,unit,price,cap) join stores s on s.trn_code = v.trn;
