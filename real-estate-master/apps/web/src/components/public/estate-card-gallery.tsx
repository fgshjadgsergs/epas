"use client";

import { useState } from "react";

interface EstateCardGalleryProps {
  images: string[];
  title: string;
}

export function EstateCardGallery({ images, title }: EstateCardGalleryProps) {
  const [index, setIndex] = useState(0);
  const hasManyImages = images.length > 1;
  const currentImage = images[index] ?? images[0];

  const move = (delta: number): void => {
    setIndex((currentIndex) => {
      const nextIndex = currentIndex + delta;

      if (nextIndex < 0) {
        return images.length - 1;
      }

      if (nextIndex >= images.length) {
        return 0;
      }

      return nextIndex;
    });
  };

  return (
    <div className="card-gallery js-card-gallery">
      <div className="card-gallery__frame">
        <img className="card-gallery__img" src={currentImage} alt={title} loading="lazy" />

        {hasManyImages ? (
          <>
            <button
              className="card-gallery__btn card-gallery__btn--prev"
              type="button"
              aria-label="Предыдущее фото"
              onClick={() => move(-1)}
            >
              ‹
            </button>
            <button
              className="card-gallery__btn card-gallery__btn--next"
              type="button"
              aria-label="Следующее фото"
              onClick={() => move(1)}
            >
              ›
            </button>

          </>
        ) : null}
      </div>

      {/* Точки вынесены из кадра: на самой фотографии не должно быть
          посторонних элементов. */}
      {hasManyImages ? (
        <div className="card-gallery__dots" aria-hidden="true">
          {images.map((image, imageIndex) => (
            <span
              key={`${image}-${imageIndex}`}
              className={`card-gallery__dot${imageIndex === index ? " is-active" : ""}`}
            />
          ))}
        </div>
      ) : (
        <div className="card-gallery__dots" aria-hidden="true" />
      )}
    </div>
  );
}

