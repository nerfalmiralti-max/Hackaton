# Electromagnetic induction: synthetic educational demo

**Provenance (EN):** Synthetic educational example for this local demo. Not official NIS curriculum, not an official school document, and not evidence of a NIS integration.

**Происхождение (RU):** Синтетический учебный пример для локальной демонстрации. Это не официальная учебная программа НИШ и не официальный школьный документ.

**Шығу тегі (KZ):** Жергілікті демонстрацияға арналған жасанды оқу мысалы. Бұл НЗМ-нің ресми оқу бағдарламасы да, ресми мектеп құжаты да емес.

## Key terms / Термины / Негізгі терминдер

| English | Русский | Қазақша |
| --- | --- | --- |
| Electromagnetic induction | Электромагнитная индукция | Электромагниттік индукция |
| Magnetic flux | Магнитный поток | Магнит ағыны |
| Induced electromotive force (EMF) | ЭДС индукции | Индукцияның электр қозғаушы күші (ЭҚК) |
| Coil turn | Виток катушки | Катушка орамы |
| Faraday's law | Закон Фарадея | Фарадей заңы |
| Lenz's law | Правило Ленца | Ленц ережесі |

## Faraday's law

For a coil with N turns and the same magnetic flux Phi through each turn, the average induced EMF is:

    average EMF = -N * (Phi_final - Phi_initial) / delta_t

Flux is measured in webers (Wb), time in seconds (s), and EMF in volts (V). The minus sign expresses Lenz's law: the induced current, if a closed conducting circuit exists, produces a magnetic effect that opposes the change in flux. A numerical sign requires a chosen winding and flux orientation. For a uniform field through a flat loop, Phi = B * A * cos(theta), where theta is the angle between the field and the normal to the loop.

## Worked example / Пример / Есеп

A 50-turn coil experiences a uniform decrease in flux **per turn**, from 0.020 Wb to 0.005 Wb in 0.10 s. Find the magnitude of its average induced EMF.

    N = 50
    delta_Phi = 0.005 - 0.020 = -0.015 Wb
    |average EMF| = 50 * 0.015 / 0.10 = 7.5 V

**EN:** The average induced EMF magnitude is **7.5 V**. With a constant rate of change, the instantaneous magnitude is also 7.5 V during that interval. This is a voltage, not a current; current additionally depends on the circuit.

**RU:** Магнитный поток через каждый виток катушки из 50 витков уменьшается с 0,020 до 0,005 Вб за 0,10 с. Модуль средней ЭДС индукции равен **7,5 В**. Для определения силы тока нужны дополнительные сведения о цепи.

**KZ:** 50 орамды катушканың әр орамы арқылы өтетін магнит ағыны 0,10 с ішінде 0,020 Вб-ден 0,005 Вб-ге дейін азаяды. Орташа индукция ЭҚК-інің модулі **7,5 В**. Ток күшін анықтау үшін электр тізбегі туралы қосымша мәлімет қажет.

If the same flux change took 0.20 s, the average EMF magnitude would be 3.75 V. The shorter the time for the same change, the greater the average EMF magnitude.
