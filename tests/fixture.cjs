const {PDFDocument,StandardFonts}=require('pdf-lib');
const fs=require('node:fs/promises');
(async()=>{
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
 for(let i=1;i<=12;i++){const p=pdf.addPage([595,842]);p.drawText(`Reader regression test page ${i}`,{x:50,y:760,size:18,font});p.drawText(`Wavelength 980 nm. Evidence on page ${i}.`,{x:50,y:700,size:12,font});}
 await fs.writeFile('/workspace/scratch/3fbdbb3a07bd/reader-fixture.pdf',await pdf.save());
})();
