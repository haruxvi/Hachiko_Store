"""Pipeline de análisis de datos y machine learning de Hachiko.

Este paquete corre FUERA de Vercel (por batch, en GitHub Actions). Lee el
esquema operacional desde Neon, entrena modelos y escribe predicciones en las
tablas del plano analítico. Next.js solo LEE esos resultados con Prisma.
"""
