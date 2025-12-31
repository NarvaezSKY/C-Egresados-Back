// pdfGenerator.js
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PDFGenerator {
  /**
   * Genera un carné vertical tipo credencial (pixel-perfect según especificación)
   * @param {Object} egresadoData - { nombre, cedula, ficha, programa, regional, centro, fechaEgreso, carnetExpires }
   * @param {import('http').ServerResponse} res - response express (o similar)
   * @param {Buffer|null} qrBuffer - Buffer con imagen QR (png/jpg)
   * @param {Buffer|null} photoBuffer - Buffer con fotografía (opcional, si null se deja cuadro gris)
   */
  async generateCarnet(egresadoData, res, qrBuffer = null, photoBuffer = null) {
    // Tamaño tipo credencial: 3.37" x 2.125" -> aprox 242 x 384 puntos (ajustado para contenido)
    const width = 242;
    const height = 375; // Reducido para eliminar espacio en blanco inferior
    const doc = new PDFDocument({
      size: [width, height],
      margins: { top: 0, left: 0, right: 0, bottom: 0 }
    });

    // Headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=carnet-${egresadoData.cedula || "unknown"}-${Date.now()}.pdf`
    );

    doc.pipe(res);

    // Colores
    const GREEN = "#39A900";
    const GREY = "#666666";
    const LIGHT_GREY = "#E5E5E5";
    const BLACK = "#000000";

    // Margen interior para los elementos (para reproducir proporciones de la imagen)
    const left = 12;
    const right = 12;
    const top = 18; // Aumentado margen superior

    // --- HEADER: logo (izq) y cuadro fotografía (der) ---
    // Logo SENA (siempre usar el logo de la raíz del proyecto)
    const logoWidth = 50; // tamaño del logo
    const logoX = left;
    const logoY = top;
    // Ruta absoluta al logo (desde utils/ subimos un nivel a la raíz)
    const logoPath = path.join(__dirname, "..", "logosena.png");
    doc.image(logoPath, logoX, logoY, { width: logoWidth });

    // Cuadro de fotografía (parte superior derecha), tamaño proporcional a la referencia
    const photoBoxW = 68;
    const photoBoxH = 78;
    const photoBoxX = width - right - photoBoxW;
    const photoBoxY = top + 4;

    // marco del cuadro (relleno gris claro)
    doc.rect(photoBoxX, photoBoxY, photoBoxW, photoBoxH)
       .fillColor(LIGHT_GREY)
       .fill();

    // Si hay photoBuffer, la insertamos centrada en el cuadro con cover-fit
    if (photoBuffer) {
      try {
        // Calcular cover-fit para no distorsionar (centrado)
        doc.image(photoBuffer, photoBoxX + 4, photoBoxY + 4, {
          fit: [photoBoxW - 8, photoBoxH - 8],
          align: "center",
          valign: "center"
        });
      } catch (e) {
        // ignore, dejamos el cuadro gris
      }
    } else {
      // Texto "EGRESADO" centrado dentro del cuadro
      doc.fillColor(GREY)
         .fontSize(9)
         .font("Helvetica-Bold")
         .text("EGRESADO", photoBoxX, photoBoxY + (photoBoxH / 2) - 6, {
           width: photoBoxW,
           align: "center"
         });
    }

    // --- Línea verde (debajo del header, sin texto "EGRESADO") ---
    const lineY = photoBoxY + photoBoxH + 8; // posición justo debajo del header
    const lineX = left;
    const lineWidth = width - left - right; // línea completa de margen a margen
    doc.rect(lineX, lineY, lineWidth, 1.5)
       .fillColor(GREEN)
       .fill();

    // --- NOMBRE (verde, negrita, alineado a la izquierda con desplazamiento como la imagen) ---
    const nameY = lineY + 6;
    const nameBoxWidth = width - left - right - 20; // espacio lateral
    doc.fillColor(GREEN)
       .fontSize(14)
       .font("Helvetica-Bold")
       .text(egresadoData.nombre || "Nombres\nApellidos", left, nameY, {
         width: nameBoxWidth,
         align: "left",
         lineGap: -2
       });

    // --- QR centrado debajo del nombre (proporción y tamaño según la referencia) ---
    const qrSize = 80; // tamaño QR reducido para que quepa mejor
    // Calcular Y para que visualmente coincida con la referencia:
    // (dejamos un espacio vertical razonable entre nombre y QR)
    const qrY = nameY + 42;
    const qrX = Math.round((width - qrSize) / 2);

    if (qrBuffer) {
      try {
        doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
      } catch (e) {
        // Si falla, dibujar borde placeholder
        doc.rect(qrX, qrY, qrSize, qrSize)
           .strokeColor(GREY)
           .lineWidth(0.5)
           .stroke();
      }
    } else {
      // placeholder QR
      doc.rect(qrX, qrY, qrSize, qrSize)
         .strokeColor(GREY)
         .lineWidth(0.5)
         .stroke();
    }

    // Texto pequeño debajo del QR: "Escanea para verificar" y "Válido hasta: DD/MM/YYYY"
    const smallTextY = qrY + qrSize + 4;
    doc.fillColor(GREY)
       .fontSize(6)
       .font("Helvetica")
       .text("Escanea para verificar", qrX, smallTextY, {
         width: qrSize,
         align: "center"
       });

    if (egresadoData.carnetExpires) {
      doc.fontSize(6)
         .font("Helvetica")
         .text(`Válido hasta: ${egresadoData.carnetExpires}`, qrX, smallTextY + 8, {
           width: qrSize,
           align: "center"
         });
    }

    // --- Fila c.c. y Ficha (en dos columnas, alineado izquierda/derecha similar a referencia) ---
    // Ponemos esta fila bajo el QR, con margen lateral para que quede similar
    const rowY = smallTextY + 24;
    const labelLeftX = left + 4;
    const labelRightX = width - right - 65;

    // c.c.
    doc.fillColor(GREY)
       .fontSize(7)
       .font("Helvetica-Bold")
       .text("c.c.", labelLeftX, rowY);

    doc.fillColor(BLACK)
       .fontSize(8)
       .font("Helvetica")
       .text(egresadoData.cedula || "1110288054", labelLeftX + 18, rowY);

    // Ficha (alineado a la derecha de la fila)
    doc.fillColor(GREY)
       .fontSize(7)
       .font("Helvetica-Bold")
       .text("Ficha:", labelRightX, rowY);

    doc.fillColor(BLACK)
       .fontSize(8)
       .font("Helvetica")
       .text(egresadoData.ficha || "2556678", labelRightX + 30, rowY);

    // --- Programa (negrita, centrado, con altura dinámica) ---
    const programaY = rowY + 18;
    doc.fillColor(BLACK)
       .fontSize(8.5)
       .font("Helvetica-Bold")
       .text(egresadoData.programa || "ANÁLISIS Y DESARROLLO DE SOFTWARE", left + 4, programaY, {
         width: width - left - right - 8,
         align: "center",
         lineGap: 1
       });

    // Calcular altura del texto del programa para espaciado dinámico
    const programaHeight = doc.heightOfString(egresadoData.programa || "ANÁLISIS Y DESARROLLO DE SOFTWARE", {
      width: width - left - right - 8,
      lineGap: 1
    });

    // --- Regional (verde) ---
    const regionalY = programaY + programaHeight + 10;
    doc.fillColor(GREEN)
       .fontSize(8)
       .font("Helvetica-Bold")
       .text(egresadoData.regional || "Regional Cauca", left, regionalY, {
         width: width - left - right,
         align: "center"
       });

    // --- Centro de formación (verde, texto más pequeño) ---
    const centroY = regionalY + 12;
    doc.fillColor(GREEN)
       .fontSize(7)
       .font("Helvetica-Bold")
       .text(egresadoData.centro || "Centro de Teleinformática y Producción Industrial", left + 6, centroY, {
         width: width - left - right - 12,
         align: "center",
         lineGap: 0
       });

    // Calcular altura del centro para espaciado dinámico
    const centroHeight = doc.heightOfString(egresadoData.centro || "Centro de Teleinformática y Producción Industrial", {
      width: width - left - right - 12,
      lineGap: 0
    });

    // --- Fecha de certificación (negro, centrado, abajo) ---
    const fechaY = centroY + centroHeight + 10;
    doc.fillColor(BLACK)
       .fontSize(7)
       .font("Helvetica")
       .text(`Fecha de certificación: ${egresadoData.fechaEgreso || "01/12/2024"}`, left, fechaY, {
         width: width - left - right,
         align: "center"
       });

    // Opcional: delgado borde exterior (muy sutil) para dar aspecto de tarjeta - si no lo quieres comentar esta parte
    // Doc.strokeColor('#e6e6e6').lineWidth(0.8).rect(6, 6, width - 12, height - 12).stroke();

    doc.end();
  }

  // Método auxiliar para generar un PDF de ejemplo local (solo para pruebas, no usado por la API)
  async generateExample(outputPath = "./carnet_ejemplo.pdf") {
    const fakeRes = fs.createWriteStream(outputPath);
    const sample = {
      nombre: "Cristian Samir\nNarvaez Quintero",
      cedula: "1110288054",
      ficha: "2556678",
      programa: "ANÁLISIS Y DESARROLLO DE SOFTWARE",
      regional: "Regional Cauca",
      centro: "Centro de Teleinformática y Producción Industrial",
      fechaEgreso: "01/12/2024",
      carnetExpires: "22/11/2025"
    };

    await this.generateCarnet(sample, { setHeader: () => {}, pipe: (stream) => {}, end: () => {} }, null, null);

    // Nota: generateCarnet espera un objeto 'res' tipo http.Response con .setHeader y .pipe.
    // Para crear un archivo local de prueba, es más directo replicar la lógica en un script separado.
  }
}

export default new PDFGenerator();
