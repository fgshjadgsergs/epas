"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

interface DetailGalleryAppProps {
  images: string[];
  title: string;
}

/**
 * Галерея страницы объекта: крупный чистый кадр без наложений и полоса
 * миниатюр под ним. Миниатюры нагляднее точек — сразу видно, какие
 * ракурсы есть, и по ним проще попасть пальцем.
 */
export function DetailGalleryApp({ images, title }: DetailGalleryAppProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const hasManyImages = images.length > 1;
  const currentImage = images[activeIndex] ?? images[0];

  const move = (delta: number): void => {
    setActiveIndex((current) => {
      const next = current + delta;

      if (next < 0) {
        return images.length - 1;
      }

      if (next >= images.length) {
        return 0;
      }

      return next;
    });
  };

  return (
    <div className="dg">
      <div className="dg__frame">
        <a href={currentImage} target="_blank" rel="noreferrer" aria-label="Открыть фото в полном размере">
          <img src={currentImage} alt={title} />
        </a>

        {hasManyImages ? (
          <>
            <button type="button" className="dg__nav dg__nav--prev" aria-label="Предыдущее фото" onClick={() => move(-1)}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <button type="button" className="dg__nav dg__nav--next" aria-label="Следующее фото" onClick={() => move(1)}>
              <ChevronRight aria-hidden="true" />
            </button>

            <span className="dg__counter">
              {activeIndex + 1} / {images.length}
            </span>
          </>
        ) : null}
      </div>

      {hasManyImages ? (
        <div className="dg__thumbs" role="tablist" aria-label="Фотографии объекта">
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={`Фото ${index + 1}`}
              className={`dg__thumb${index === activeIndex ? " is-active" : ""}`}
              onClick={() => setActiveIndex(index)}
            >
              <img src={image} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
