import PDFDocument from "pdfkit";

class PDFGenerator {
  
  // 📌 Generar carnet PDF para egresado
  async generateCarnet(egresadoData, res, qrBuffer = null) {
    const doc = new PDFDocument({
      size: [300, 480], // Aumentar un poco la altura para acomodar el QR
      margins: { top: 15, bottom: 15, left: 20, right: 20 }
    });

    // Configurar headers de respuesta
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=carnet-${egresadoData.cedula}-${Date.now()}.pdf`
    );

    doc.pipe(res);

    // 🎨 DISEÑO DEL CARNET - REORGANIZADO PARA UNA SOLA PÁGINA
    this._drawHeader(doc);
    this._drawAvatar(doc);
    this._drawEgresadoLabel(doc);
    
    // Dibujar QR centrado debajo del avatar si se proporciona
    if (qrBuffer) {
      this._drawQRCode(doc, qrBuffer, egresadoData);
    }
    
    this._drawPersonalInfo(doc, egresadoData, qrBuffer ? true : false);

    doc.end();
  }

  // 📌 Dibujar header con logo SENA
  _drawHeader(doc) {
    try {
      // Intentar cargar y agregar el logo SENA
      doc.image('./logosena.png', 20, 15, { width: 30, height: 30 });
      // Texto SENA junto al logo
      doc.fillColor("#39A900")
        .fontSize(22)
        .font("Helvetica-Bold")
        .text("SENA", 60, 20);
    } catch (error) {
      // Si no se encuentra el logo, solo mostrar el texto
      doc.fillColor("#39A900")
        .fontSize(22)
        .font("Helvetica-Bold")
        .text("SENA", 20, 20);
    }
  }

  // 📌 Dibujar avatar genérico
  _drawAvatar(doc) {
    // Marco circular gris claro
    doc.lineWidth(2)
      .strokeColor('#CCCCCC')
      .circle(80, 150, 32)
      .stroke();

    // Avatar más pequeño (círculo y elipse)
    doc.circle(80, 140, 18).fill("#9CA3AF");
    doc.ellipse(80, 170, 25, 12).fill("#9CA3AF");
  }

  // 📌 Dibujar etiqueta "EGRESADO"
  _drawEgresadoLabel(doc) {
    doc.fillColor("#39A900")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("EGRESADO", 180, 120);
  }

  // 📌 Dibujar información personal del egresado
  _drawPersonalInfo(doc, egresadoData, hasQR = false) {
    // Ajustar posición inicial según si hay QR o no
    let yPos = hasQR ? 290 : 250; // Si hay QR, comenzar más abajo

    // Nombres y Apellidos en verde
    doc.fillColor("#39A900")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(egresadoData.nombre || "Nombres Apellidos", 20, yPos, {
        width: 260,
        align: "center"
      });

    yPos += 18; // Reducir espacio

    // Número de documento
    doc.fillColor("#000000")
      .fontSize(10)
      .font("Helvetica")
      .text(`C.C. ${egresadoData.cedula || "N/A"}`, 20, yPos, {
        width: 260,
        align: "center"
      });

    yPos += 15; // Reducir espacio

    // Ficha
    doc.fontSize(10)
      .font("Helvetica")
      .text(`Ficha: ${egresadoData.ficha || "N/A"}`, 20, yPos, {
        width: 260,
        align: "center"
      });

    yPos += 15; // Reducir espacio

    // Programa de formación
    doc.fontSize(9)
      .font("Helvetica")
      .text(egresadoData.programa || "Programa de formación", 20, yPos, {
        width: 260,
        align: "center"
      });

    yPos += 25; // Reducir espacio

    // Regional en verde
    doc.fillColor("#39A900")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(egresadoData.regional || "Regional Cauca", 20, yPos, {
        width: 260,
        align: "center"
      });

    yPos += 15; // Reducir espacio

    // Centro de formación en verde
    doc.fontSize(8) // Reducir tamaño de fuente
      .font("Helvetica-Bold")
      .text(egresadoData.centro, 20, yPos, {
        width: 260,
        align: "center"
      });

    yPos += 20; // Reducir espacio

    // Fecha de certificación
    doc.fillColor("#000000")
      .fontSize(9)
      .font("Helvetica")
      .text(`Fecha de certificación: ${egresadoData.fechaEgreso}`, 20, yPos, {
        width: 260,
        align: "center"
      });
  }

  // 📌 Dibujar código QR centrado debajo del avatar
  _drawQRCode(doc, qrBuffer, egresadoData) {
    try {
      // Posición centrada debajo del avatar
      const qrSize = 60;
      const pageWidth = 300;
      const xPos = (pageWidth - qrSize) / 2; // Centrar horizontalmente
      const yPos = 190; // Debajo del avatar (avatar está en ~150)

      // Marco sutil alrededor del QR
      doc.rect(xPos - 2, yPos - 2, qrSize + 4, qrSize + 4)
         .strokeColor('#E5E5E5')
         .lineWidth(1)
         .stroke();

      // Insertar imagen QR
      doc.image(qrBuffer, xPos, yPos, {
        width: qrSize,
        height: qrSize
      });

      // Texto "Escanea para verificar" centrado debajo del QR
      doc.fillColor("#666666")
         .fontSize(8)
         .font("Helvetica")
         .text("Escanea para verificar", 20, yPos + qrSize + 8, {
           width: 260,
           align: "center"
         });

      // Fecha de vencimiento del carnet
      if (egresadoData.carnetExpires) {
        doc.fontSize(7)
           .text(`Válido hasta: ${egresadoData.carnetExpires}`, 20, yPos + qrSize + 22, {
             width: 260,
             align: "center"
           });
      }

    } catch (error) {
      console.error('❌ Error agregando QR al PDF:', error);
      // Si falla el QR, continuar sin él
    }
  }

  // 📌 Generar reporte PDF de estadísticas (útil para administradores)
  async generateStatsReport(statsData, res) {
    const doc = new PDFDocument();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=reporte-estadisticas.pdf`
    );

    doc.pipe(res);

    // Header del reporte
    doc.fontSize(18)
       .font("Helvetica-Bold")
       .text("Reporte de Estadísticas - Egresados SENA", { align: "center" });

    doc.moveDown();

    // Información general
    doc.fontSize(14)
       .font("Helvetica-Bold")
       .text(`Total de egresados: ${statsData.total}`);

    doc.moveDown();

    // Programas
    doc.fontSize(12)
       .font("Helvetica-Bold")
       .text("Distribución por programas:");

    Object.entries(statsData.programas).forEach(([programa, cantidad]) => {
      doc.fontSize(10)
         .font("Helvetica")
         .text(`• ${programa}: ${cantidad} egresados`);
    });

    doc.moveDown();
    doc.fontSize(8)
       .text(`Generado el: ${new Date().toLocaleString('es-ES')}`);

    doc.end();
  }
}

export default new PDFGenerator();