# Covariance & Contravariance in TypeScript

## Covariance → Child as Parent

Covariance allows a **subtype** to be used wherever a **supertype** is expected.  
It generally works for **outputs (read-only)**.

```typescript
class Animal {}
class Dog extends Animal {}

let dogs: ReadonlyArray<Dog> = [new Dog()];
let animals: ReadonlyArray<Animal> = dogs; //  Covariant
```

## Contravariance → → Parent as Child

Contravariance allows a **supertype** to be used wherever a subtype is expected.
It generally works for inputs (consumers).

```typescript
class Animal {}
class Dog extends Animal {}

type Handler<T> = (input: T) => void;

let handleAnimal: Handler<Animal> = (a: Animal) => console.log("Got", a);
let handleDog: Handler<Dog> = handleAnimal; // Contravariant
```
